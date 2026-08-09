import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type PressableStateCallbackType,
} from "react-native";
import { StyleSheet, useUnistyles, withUnistyles } from "react-native-unistyles";
import { BUILTIN_PROVIDER_IDS } from "@getvincu/protocol/provider-manifest";
import { useIsCompactFormFactor } from "@/constants/layout";
import { isNative } from "@/constants/platform";
import { settingsStyles } from "@/styles/settings";
import type { Theme } from "@/styles/theme";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { useHostFeature } from "@/runtime/host-features";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import { buildProviderDefinitions, orderProviderDefinitions } from "@/utils/provider-definitions";
import {
  buildAcpProviderConfigPatch,
  type AcpProviderCatalogItem,
} from "@/hooks/use-acp-provider-catalog";
import { ProviderCatalogList } from "@/components/provider-catalog-list";
import { getProviderIcon } from "@/components/provider-icons";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "@/screens/settings/settings-section";
import { useProviderSettingsStore } from "@/stores/provider-settings-store";
import { confirmDialog } from "@/utils/confirm-dialog";
import { copyToClipboard } from "@/utils/copy-to-clipboard";
import { openExternalUrl } from "@/utils/open-external-url";
import { useToast } from "@/contexts/toast-context";
import { filterSelectableModels } from "@/provider-selection/model-catalog";
import {
  ADDABLE_BUILTIN_PROVIDERS,
  isProviderAccountBase,
  isProviderAccountId,
  nextDefaultProviderAccountLabel,
  providerAccountCompanyName,
  resolveProviderAccountBase,
  type ProviderAccountBase,
} from "@/provider-accounts/is-provider-account";
import { AdaptiveRenameModal } from "@/components/rename-modal";
import { DraggableList, type DraggableRenderItemInfo } from "@/components/draggable-list";
import type { DraggableListDragHandleProps } from "@/components/draggable-list.types";
import {
  Copy,
  ExternalLink,
  GripVertical,
  LogIn,
  LogOut,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react-native";

const MENU_ICON_SIZE = 14;
const mutedColorMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });
const foregroundColorMapping = (theme: Theme) => ({ color: theme.colors.foreground });
const destructiveColorMapping = (theme: Theme) => ({ color: theme.colors.destructive });

const ThemedKebab = withUnistyles(MoreVertical);
const ThemedRefreshCw = withUnistyles(RefreshCw);
const ThemedLogOut = withUnistyles(LogOut);
const ThemedPencil = withUnistyles(Pencil);
const ThemedTrash2 = withUnistyles(Trash2);
const ThemedGripVertical = withUnistyles(GripVertical);
const ThemedApiKeyInput = withUnistyles(TextInput, (theme: Theme) => ({
  placeholderTextColor: theme.colors.foregroundMuted,
}));

const reconnectLeading = <ThemedRefreshCw size={MENU_ICON_SIZE} uniProps={mutedColorMapping} />;
const logoutLeading = <ThemedLogOut size={MENU_ICON_SIZE} uniProps={mutedColorMapping} />;
const renameLeading = <ThemedPencil size={MENU_ICON_SIZE} uniProps={mutedColorMapping} />;
const removeMenuLeading = <ThemedTrash2 size={MENU_ICON_SIZE} uniProps={destructiveColorMapping} />;

interface PendingAccountLogin {
  loginUrl: string | null;
  loginCode: string | null;
}

type ProviderDefinition = ReturnType<typeof buildProviderDefinitions>[number];
type ProviderEntry = NonNullable<ReturnType<typeof useProvidersSnapshot>["entries"]>[number];

type StatusTone = "success" | "warning" | "danger" | "muted" | "loading";

interface ProviderStatus {
  tone: StatusTone;
  label: string;
  modelCount: number | null;
}

function getProviderStatus(
  status: string,
  enabled: boolean,
  modelCount: number,
  t: TFunction,
): ProviderStatus {
  if (!enabled)
    return { tone: "muted", label: t("settings.providers.statuses.disabled"), modelCount: null };
  if (status === "loading") {
    return { tone: "loading", label: t("settings.providers.statuses.loading"), modelCount: null };
  }
  if (status === "error") {
    return { tone: "danger", label: t("settings.providers.statuses.error"), modelCount: null };
  }
  if (status === "ready") {
    return {
      tone: "success",
      label: t("settings.providers.statuses.available"),
      modelCount: modelCount > 0 ? modelCount : null,
    };
  }
  return {
    tone: "warning",
    label: t("settings.providers.statuses.notInstalled"),
    modelCount: null,
  };
}

interface ProviderRowProps {
  def: ProviderDefinition;
  entry: ProviderEntry;
  enabled: boolean;
  isToggling: boolean;
  isRemoving: boolean;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  canRemove: boolean;
  showLogin: boolean;
  showAccountMenu: boolean;
  showRename: boolean;
  pendingLogin: PendingAccountLogin | null;
  accountBase: ProviderAccountBase | null;
  isFirst: boolean;
  isActive: boolean;
  drag: () => void;
  dragHandleProps?: DraggableListDragHandleProps;
  onPress: (providerId: string) => void;
  onToggleEnabled: (providerId: string, enabled: boolean) => void;
  onLogin: (providerId: string) => void;
  onRename: (providerId: string) => void;
  onLogout: (providerId: string, providerLabel: string) => void;
  onCopyLoginCode: (providerId: string) => void;
  onOpenLoginPage: (providerId: string) => void;
  onRemove: (providerId: string, providerLabel: string) => void;
}

function renderAccountKebabIcon({ hovered }: { hovered?: boolean }): ReactElement {
  return (
    <ThemedKebab
      size={MENU_ICON_SIZE}
      uniProps={hovered ? foregroundColorMapping : mutedColorMapping}
    />
  );
}

function accountKebabTriggerStyle({
  hovered = false,
}: PressableStateCallbackType & { hovered?: boolean }) {
  return [styles.kebabTrigger, hovered && styles.kebabTriggerHovered];
}

function stopPressInPropagation(event: GestureResponderEvent) {
  event.stopPropagation();
}

function resolveAccountSubtitle(input: {
  isAccount: boolean;
  pendingLoginCode: string | null;
  accountEmail: string | undefined;
  t: TFunction;
}): string | null {
  if (!input.isAccount) {
    return null;
  }
  if (input.pendingLoginCode) {
    return input.t("settings.providers.accounts.loginCodeLabel", { code: input.pendingLoginCode });
  }
  return input.accountEmail ?? input.t("settings.providers.accounts.signInForEmail");
}

function resolveAccountSubtitleStyle(input: {
  pendingLoginCode: string | null;
  isAccount: boolean;
  hasAccountEmail: boolean;
}) {
  if (input.pendingLoginCode) {
    return styles.loginCodeHint;
  }
  if (input.isAccount && !input.hasAccountEmail) {
    return styles.accountEmailMuted;
  }
  return settingsStyles.rowHint;
}

function UnsignedAccountActionsMenu({
  providerId,
  title,
  isRemoving,
  isLoggingIn,
  showRename,
  canRemove,
  onRename,
  onRemove,
  removeLabel,
}: {
  providerId: string;
  title: string;
  isRemoving: boolean;
  isLoggingIn: boolean;
  showRename: boolean;
  canRemove: boolean;
  onRename: (providerId: string) => void;
  onRemove: (providerId: string, providerLabel: string) => void;
  removeLabel: string;
}) {
  const { t } = useTranslation();
  const menuBusy = isLoggingIn || isRemoving;
  const handleRename = useCallback(() => {
    onRename(providerId);
  }, [onRename, providerId]);
  const handleRemove = useCallback(() => {
    onRemove(providerId, removeLabel);
  }, [onRemove, providerId, removeLabel]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        hitSlop={8}
        style={accountKebabTriggerStyle}
        onPressIn={stopPressInPropagation}
        accessibilityRole={isNative ? "button" : undefined}
        accessibilityLabel={t("settings.providers.accounts.actionsMenu", { name: title })}
        testID={`provider-account-menu-${providerId}`}
      >
        {renderAccountKebabIcon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" width={220}>
        {showRename ? (
          <DropdownMenuItem
            leading={renameLeading}
            disabled={menuBusy}
            onSelect={handleRename}
            testID={`provider-rename-${providerId}`}
          >
            {t("settings.providers.actions.rename")}
          </DropdownMenuItem>
        ) : null}
        {showRename && canRemove ? <DropdownMenuSeparator /> : null}
        {canRemove ? (
          <DropdownMenuItem
            leading={removeMenuLeading}
            destructive
            disabled={menuBusy}
            status={isRemoving ? "pending" : "idle"}
            pendingLabel={t("settings.providers.actions.removing")}
            onSelect={handleRemove}
            testID={`provider-remove-${providerId}`}
          >
            {t("settings.providers.actions.remove")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UnsignedAccountActions({
  providerId,
  title,
  isRemoving,
  isLoggingIn,
  showLogin,
  showRename,
  pendingLogin,
  canRemove,
  onLogin,
  onRename,
  onCopyLoginCode,
  onOpenLoginPage,
  onRemove,
  removeLabel,
}: {
  providerId: string;
  title: string;
  isRemoving: boolean;
  isLoggingIn: boolean;
  showLogin: boolean;
  showRename: boolean;
  pendingLogin: PendingAccountLogin | null;
  canRemove: boolean;
  onLogin: (providerId: string) => void;
  onRename: (providerId: string) => void;
  onCopyLoginCode: (providerId: string) => void;
  onOpenLoginPage: (providerId: string) => void;
  onRemove: (providerId: string, providerLabel: string) => void;
  removeLabel: string;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const pendingLoginCode = pendingLogin?.loginCode ?? null;
  const showActionsMenu = showRename || canRemove;
  const loginIcon = useMemo(
    () => <LogIn size={theme.iconSize.sm} color={theme.colors.foreground} />,
    [theme.colors.foreground, theme.iconSize.sm],
  );
  const copyIcon = useMemo(
    () => <Copy size={theme.iconSize.sm} color={theme.colors.foreground} />,
    [theme.colors.foreground, theme.iconSize.sm],
  );
  const openIcon = useMemo(
    () => <ExternalLink size={theme.iconSize.sm} color={theme.colors.foreground} />,
    [theme.colors.foreground, theme.iconSize.sm],
  );
  const handleLogin = useCallback(() => {
    onLogin(providerId);
  }, [onLogin, providerId]);
  const handleCopyLoginCode = useCallback(() => {
    onCopyLoginCode(providerId);
  }, [onCopyLoginCode, providerId]);
  const handleOpenLoginPage = useCallback(() => {
    onOpenLoginPage(providerId);
  }, [onOpenLoginPage, providerId]);

  return (
    <>
      {showLogin && pendingLoginCode ? (
        <Button
          variant="outline"
          size="sm"
          leftIcon={copyIcon}
          onPressIn={stopPressInPropagation}
          onPress={handleCopyLoginCode}
          disabled={isRemoving}
          testID={`provider-copy-login-code-${providerId}`}
        >
          {t("settings.providers.accounts.loginCopyCode")}
        </Button>
      ) : null}
      {showLogin && pendingLogin?.loginUrl ? (
        <Button
          variant="outline"
          size="sm"
          leftIcon={openIcon}
          onPressIn={stopPressInPropagation}
          onPress={handleOpenLoginPage}
          disabled={isRemoving}
          testID={`provider-open-login-${providerId}`}
        >
          {t("settings.providers.accounts.loginOpenLabel")}
        </Button>
      ) : null}
      {showLogin && !pendingLoginCode ? (
        <Button
          variant="outline"
          size="sm"
          leftIcon={loginIcon}
          onPressIn={stopPressInPropagation}
          onPress={handleLogin}
          disabled={isLoggingIn || isRemoving}
          loading={isLoggingIn}
          testID={`provider-login-${providerId}`}
        >
          {isLoggingIn
            ? t("settings.providers.accounts.loggingIn")
            : t("settings.providers.actions.login")}
        </Button>
      ) : null}
      {showActionsMenu ? (
        <UnsignedAccountActionsMenu
          providerId={providerId}
          title={title}
          isRemoving={isRemoving}
          isLoggingIn={isLoggingIn}
          showRename={showRename}
          canRemove={canRemove}
          onRename={onRename}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      ) : null}
    </>
  );
}

function SignedInAccountMenu({
  providerId,
  title,
  isRemoving,
  isLoggingIn,
  isLoggingOut,
  onLogin,
  onRename,
  onLogout,
  onRemove,
  removeLabel,
}: {
  providerId: string;
  title: string;
  isRemoving: boolean;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  onLogin: (providerId: string) => void;
  onRename: (providerId: string) => void;
  onLogout: (providerId: string, providerLabel: string) => void;
  onRemove: (providerId: string, providerLabel: string) => void;
  removeLabel: string;
}) {
  const { t } = useTranslation();
  const menuBusy = isLoggingIn || isLoggingOut || isRemoving;
  const handleReconnect = useCallback(() => {
    onLogin(providerId);
  }, [onLogin, providerId]);
  const handleRename = useCallback(() => {
    onRename(providerId);
  }, [onRename, providerId]);
  const handleLogout = useCallback(() => {
    onLogout(providerId, removeLabel);
  }, [onLogout, providerId, removeLabel]);
  const handleRemove = useCallback(() => {
    onRemove(providerId, removeLabel);
  }, [onRemove, providerId, removeLabel]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        hitSlop={8}
        style={accountKebabTriggerStyle}
        onPressIn={stopPressInPropagation}
        accessibilityRole={isNative ? "button" : undefined}
        accessibilityLabel={t("settings.providers.accounts.actionsMenu", { name: title })}
        testID={`provider-account-menu-${providerId}`}
      >
        {renderAccountKebabIcon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" width={220}>
        <DropdownMenuItem
          leading={renameLeading}
          disabled={menuBusy}
          onSelect={handleRename}
          testID={`provider-rename-${providerId}`}
        >
          {t("settings.providers.actions.rename")}
        </DropdownMenuItem>
        <DropdownMenuItem
          leading={reconnectLeading}
          disabled={menuBusy}
          status={isLoggingIn ? "pending" : "idle"}
          pendingLabel={t("settings.providers.accounts.loggingIn")}
          onSelect={handleReconnect}
          testID={`provider-reconnect-${providerId}`}
        >
          {t("settings.providers.actions.reconnect")}
        </DropdownMenuItem>
        <DropdownMenuItem
          leading={logoutLeading}
          disabled={menuBusy}
          status={isLoggingOut ? "pending" : "idle"}
          pendingLabel={t("settings.providers.accounts.loggingOut")}
          onSelect={handleLogout}
          testID={`provider-logout-${providerId}`}
        >
          {t("settings.providers.actions.logout")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          leading={removeMenuLeading}
          destructive
          disabled={menuBusy}
          status={isRemoving ? "pending" : "idle"}
          pendingLabel={t("settings.providers.actions.removing")}
          onSelect={handleRemove}
          testID={`provider-remove-${providerId}`}
        >
          {t("settings.providers.actions.remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProviderDragHandle({
  providerId,
  drag,
  dragHandleProps,
}: {
  providerId: string;
  drag: () => void;
  dragHandleProps?: DraggableListDragHandleProps;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const {
    role: _dragRole,
    tabIndex: _dragTabIndex,
    "aria-roledescription": _dragRoleDescription,
    ...dragAttributes
  } = dragHandleProps?.attributes ?? {};

  return (
    <Pressable
      {...dragAttributes}
      {...(dragHandleProps?.listeners ?? {})}
      ref={dragHandleProps?.setActivatorNodeRef as unknown as Ref<View>}
      onLongPress={drag}
      delayLongPress={200}
      onPressIn={stopPressInPropagation}
      accessibilityRole="button"
      accessibilityLabel={t("settings.providers.actions.dragToReorder")}
      testID={`provider-drag-handle-${providerId}`}
      style={styles.dragHandle}
      hitSlop={8}
    >
      <ThemedGripVertical size={theme.iconSize.sm} uniProps={mutedColorMapping} />
    </Pressable>
  );
}

function ProviderRowActions({
  providerId,
  title,
  showEnableToggle,
  effectiveEnabled,
  isToggling,
  isRemoving,
  isLoggingIn,
  isLoggingOut,
  showLogin,
  showAccountMenu,
  showRename,
  pendingLogin,
  canRemove,
  onToggleEnabled,
  onLogin,
  onRename,
  onLogout,
  onCopyLoginCode,
  onOpenLoginPage,
  onRemove,
  removeLabel,
}: {
  providerId: string;
  title: string;
  showEnableToggle: boolean;
  effectiveEnabled: boolean;
  isToggling: boolean;
  isRemoving: boolean;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  showLogin: boolean;
  showAccountMenu: boolean;
  showRename: boolean;
  pendingLogin: PendingAccountLogin | null;
  canRemove: boolean;
  onToggleEnabled: (providerId: string, enabled: boolean) => void;
  onLogin: (providerId: string) => void;
  onRename: (providerId: string) => void;
  onLogout: (providerId: string, providerLabel: string) => void;
  onCopyLoginCode: (providerId: string) => void;
  onOpenLoginPage: (providerId: string) => void;
  onRemove: (providerId: string, providerLabel: string) => void;
  removeLabel: string;
}) {
  const { t } = useTranslation();
  const handleToggleValueChange = useCallback(
    (value: boolean) => {
      onToggleEnabled(providerId, value);
    },
    [onToggleEnabled, providerId],
  );

  return (
    <View style={styles.trailingControls}>
      {showEnableToggle ? (
        <Switch
          value={effectiveEnabled}
          onValueChange={handleToggleValueChange}
          disabled={isToggling || isRemoving || isLoggingOut}
          accessibilityLabel={t("settings.providers.enableProvider", { name: title })}
        />
      ) : null}
      {showAccountMenu ? (
        <SignedInAccountMenu
          providerId={providerId}
          title={title}
          isRemoving={isRemoving}
          isLoggingIn={isLoggingIn}
          isLoggingOut={isLoggingOut}
          onLogin={onLogin}
          onRename={onRename}
          onLogout={onLogout}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      ) : (
        <UnsignedAccountActions
          providerId={providerId}
          title={title}
          isRemoving={isRemoving}
          isLoggingIn={isLoggingIn}
          showLogin={showLogin}
          showRename={showRename}
          pendingLogin={pendingLogin}
          canRemove={canRemove}
          onLogin={onLogin}
          onRename={onRename}
          onCopyLoginCode={onCopyLoginCode}
          onOpenLoginPage={onOpenLoginPage}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      )}
    </View>
  );
}

function resolveProviderRowModel(input: {
  def: ProviderDefinition;
  entry: ProviderEntry;
  enabled: boolean;
  accountBase: ProviderAccountBase | null;
  pendingLogin: PendingAccountLogin | null;
  t: TFunction;
}) {
  const resolvedAccountBase =
    input.accountBase ??
    (input.entry.accountBase && isProviderAccountBase(input.entry.accountBase)
      ? input.entry.accountBase
      : null);
  const isAccount = resolvedAccountBase !== null;
  const isAccountSignedIn = Boolean(input.entry.accountEmail);
  const showEnableToggle = !isAccount || isAccountSignedIn;
  const effectiveEnabled = showEnableToggle ? input.enabled : false;
  const title = input.def.label;
  const companyName = isAccount ? providerAccountCompanyName(resolvedAccountBase) : null;
  const pendingLoginCode = input.pendingLogin?.loginCode ?? null;
  const subtitle = resolveAccountSubtitle({
    isAccount,
    pendingLoginCode,
    accountEmail: input.entry.accountEmail,
    t: input.t,
  });
  const subtitleStyle = resolveAccountSubtitleStyle({
    pendingLoginCode,
    isAccount,
    hasAccountEmail: Boolean(input.entry.accountEmail),
  });
  const removeLabel = input.entry.accountEmail ? `${title} (${input.entry.accountEmail})` : title;
  const providerError =
    effectiveEnabled &&
    input.entry.status === "error" &&
    typeof input.entry.error === "string" &&
    input.entry.error.trim().length > 0
      ? input.entry.error.trim()
      : null;
  const modelCount = filterSelectableModels(input.entry.models ?? null)?.length ?? 0;
  const providerStatus = getProviderStatus(
    input.entry.status,
    effectiveEnabled,
    modelCount,
    input.t,
  );
  const accessibilityName = [title, companyName, subtitle].filter(Boolean).join(", ");
  return {
    resolvedAccountBase,
    showEnableToggle,
    effectiveEnabled,
    title,
    companyName,
    pendingLoginCode,
    subtitle,
    subtitleStyle,
    removeLabel,
    providerError,
    providerStatus,
    accessibilityName,
  };
}

function ProviderRow({
  def,
  entry,
  enabled,
  isToggling,
  isRemoving,
  isLoggingIn,
  isLoggingOut,
  canRemove,
  showLogin,
  showAccountMenu,
  showRename,
  pendingLogin,
  accountBase,
  isFirst,
  isActive,
  drag,
  dragHandleProps,
  onPress,
  onToggleEnabled,
  onLogin,
  onRename,
  onLogout,
  onCopyLoginCode,
  onOpenLoginPage,
  onRemove,
}: ProviderRowProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const isCompact = useIsCompactFormFactor();
  const model = resolveProviderRowModel({
    def,
    entry,
    enabled,
    accountBase,
    pendingLogin,
    t,
  });
  const ProviderIcon = getProviderIcon(model.resolvedAccountBase ?? def.id);

  const handlePress = useCallback(() => {
    onPress(def.id);
  }, [def.id, onPress]);
  const rowPressableStyle = useCallback(
    ({ pressed, hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
      styles.rowPressable,
      hovered && styles.rowHovered,
      pressed && styles.rowPressed,
    ],
    [],
  );

  return (
    <View
      testID={`provider-row-${def.id}`}
      style={[
        settingsStyles.row,
        !isFirst && settingsStyles.rowBorder,
        styles.row,
        isActive && styles.rowDragging,
      ]}
    >
      <ProviderDragHandle providerId={def.id} drag={drag} dragHandleProps={dragHandleProps} />
      <Pressable
        style={rowPressableStyle}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={t("settings.providers.providerDetails", {
          name: model.accessibilityName,
        })}
      >
        <View style={styles.rowContent}>
          <ProviderIcon size={theme.iconSize.md} color={theme.colors.foreground} />
          <View style={styles.textColumn}>
            <View style={styles.titleRow}>
              <Text style={settingsStyles.rowTitle} numberOfLines={1}>
                {model.title}
              </Text>
              {model.companyName ? (
                <>
                  <Text style={styles.separator}>·</Text>
                  <Text style={styles.companyLabel} numberOfLines={1}>
                    {model.companyName}
                  </Text>
                </>
              ) : null}
              {!isCompact ? <Text style={styles.separator}>·</Text> : null}
              <StatusIndicator status={model.providerStatus} compact={isCompact} />
            </View>
            {model.subtitle ? (
              <Text
                style={model.subtitleStyle}
                numberOfLines={1}
                testID={model.pendingLoginCode ? `provider-login-code-${def.id}` : undefined}
              >
                {model.subtitle}
              </Text>
            ) : null}
            {model.providerError && !isCompact ? (
              <Text style={styles.errorText} numberOfLines={3}>
                {model.providerError}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      <ProviderRowActions
        providerId={def.id}
        title={model.title}
        showEnableToggle={model.showEnableToggle}
        effectiveEnabled={model.effectiveEnabled}
        isToggling={isToggling}
        isRemoving={isRemoving}
        isLoggingIn={isLoggingIn}
        isLoggingOut={isLoggingOut}
        showLogin={showLogin}
        showAccountMenu={showAccountMenu}
        showRename={showRename && !showAccountMenu}
        pendingLogin={pendingLogin}
        canRemove={canRemove}
        onToggleEnabled={onToggleEnabled}
        onLogin={onLogin}
        onRename={onRename}
        onLogout={onLogout}
        onCopyLoginCode={onCopyLoginCode}
        onOpenLoginPage={onOpenLoginPage}
        onRemove={onRemove}
        removeLabel={model.removeLabel}
      />
    </View>
  );
}

function getDotColor(tone: StatusTone, theme: ReturnType<typeof useUnistyles>["theme"]): string {
  switch (tone) {
    case "success":
      return theme.colors.statusSuccess;
    case "warning":
      return theme.colors.statusWarning;
    case "danger":
      return theme.colors.statusDanger;
    default:
      return theme.colors.foregroundMuted;
  }
}

function StatusIndicator({ status, compact }: { status: ProviderStatus; compact: boolean }) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const dotStyle = useMemo(
    () => [styles.statusDot, { backgroundColor: getDotColor(status.tone, theme) }],
    [status.tone, theme],
  );

  return (
    <View style={styles.statusRow}>
      {status.tone === "loading" ? (
        <LoadingSpinner size={10} color={theme.colors.foregroundMuted} />
      ) : (
        <View style={dotStyle} />
      )}
      {!compact ? (
        <>
          <Text style={styles.statusLabel}>{status.label}</Text>
          {status.modelCount !== null ? (
            <>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.statusLabel}>
                {status.modelCount === 1
                  ? t("settings.providers.models.one")
                  : t("settings.providers.models.many", { count: status.modelCount })}
              </Text>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function BuiltinProviderAddButton({
  entry,
  creatingAccountBase,
  onSelect,
}: {
  entry: (typeof ADDABLE_BUILTIN_PROVIDERS)[number];
  creatingAccountBase: string | null;
  onSelect: (entry: (typeof ADDABLE_BUILTIN_PROVIDERS)[number]) => void;
}) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => {
    onSelect(entry);
  }, [entry, onSelect]);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={creatingAccountBase !== null}
      onPress={handlePress}
      testID={`provider-add-builtin-${entry.id}`}
    >
      {creatingAccountBase === entry.id ? t("settings.providers.addingInstance") : entry.label}
    </Button>
  );
}

function AddProviderCard({
  serverId,
  supportsProviderAccounts,
  creatingAccountBase,
  authChooserBase,
  apiKeyBase,
  apiKeyDraft,
  installingProviderId,
  onSelectBuiltin,
  onAuthSignIn,
  onAuthApiKey,
  onResetAddFlow,
  onApiKeyDraftChange,
  onSubmitApiKey,
  onInstall,
}: {
  serverId: string;
  supportsProviderAccounts: boolean;
  creatingAccountBase: string | null;
  authChooserBase: string | null;
  apiKeyBase: string | null;
  apiKeyDraft: string;
  installingProviderId: string | null;
  onSelectBuiltin: (entry: (typeof ADDABLE_BUILTIN_PROVIDERS)[number]) => void;
  onAuthSignIn: () => void;
  onAuthApiKey: () => void;
  onResetAddFlow: () => void;
  onApiKeyDraftChange: (value: string) => void;
  onSubmitApiKey: () => void;
  onInstall: (entry: AcpProviderCatalogItem) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const authChooserLabel =
    ADDABLE_BUILTIN_PROVIDERS.find((entry) => entry.id === authChooserBase)?.label ??
    authChooserBase;
  const apiKeyLabel =
    ADDABLE_BUILTIN_PROVIDERS.find((entry) => entry.id === apiKeyBase)?.label ?? apiKeyBase;

  return (
    <SettingsSection
      title={t("settings.providers.addProvider")}
      testID="host-page-add-provider-card"
      style={styles.addProviderSection}
    >
      <View style={styles.addProviderStack}>
        <Text style={styles.addProviderHeading}>{t("settings.providers.builtinProviders")}</Text>
        {supportsProviderAccounts ? (
          <>
            <View style={styles.accountActions}>
              {ADDABLE_BUILTIN_PROVIDERS.map((entry) => (
                <BuiltinProviderAddButton
                  key={entry.id}
                  entry={entry}
                  creatingAccountBase={creatingAccountBase}
                  onSelect={onSelectBuiltin}
                />
              ))}
            </View>
            {authChooserBase ? (
              <View style={[settingsStyles.card, styles.authChooserCard]}>
                <Text style={styles.authChooserTitle}>
                  {t("settings.providers.choosingAuth", { name: authChooserLabel })}
                </Text>
                <View style={styles.accountActions}>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={creatingAccountBase !== null}
                    onPress={onAuthSignIn}
                    testID="provider-add-auth-sign-in"
                  >
                    {creatingAccountBase === authChooserBase
                      ? t("settings.providers.addingInstance")
                      : t("settings.providers.signInWithAccount")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={creatingAccountBase !== null}
                    onPress={onAuthApiKey}
                    testID="provider-add-auth-api-key"
                  >
                    {t("settings.providers.useApiKey")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={creatingAccountBase !== null}
                    onPress={onResetAddFlow}
                    testID="provider-add-auth-cancel"
                  >
                    {t("settings.providers.apiKeyCancel")}
                  </Button>
                </View>
              </View>
            ) : null}
            {apiKeyBase ? (
              <View style={[settingsStyles.card, styles.authChooserCard]}>
                <Text style={styles.authChooserTitle}>
                  {t("settings.providers.apiKeyLabel")}
                  {" · "}
                  {apiKeyLabel}
                </Text>
                <ThemedApiKeyInput
                  value={apiKeyDraft}
                  onChangeText={onApiKeyDraftChange}
                  placeholder={t("settings.providers.apiKeyPlaceholder")}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.apiKeyInput}
                  testID="provider-add-api-key-input"
                />
                <View style={styles.accountActions}>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={creatingAccountBase !== null}
                    onPress={onSubmitApiKey}
                    testID="provider-add-api-key-submit"
                  >
                    {creatingAccountBase === apiKeyBase
                      ? t("settings.providers.addingInstance")
                      : t("settings.providers.apiKeySave")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={creatingAccountBase !== null}
                    onPress={onResetAddFlow}
                    testID="provider-add-api-key-cancel"
                  >
                    {t("settings.providers.apiKeyCancel")}
                  </Button>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={[settingsStyles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>
              {t("settings.providers.accounts.hostUpdateRequired")}
            </Text>
          </View>
        )}
        <Text style={[styles.addProviderHeading, styles.catalogHeading]}>
          {t("settings.providers.catalogProviders")}
        </Text>
        <ProviderCatalogList
          serverId={serverId}
          installingProviderId={installingProviderId}
          onInstall={onInstall}
        />
      </View>
    </SettingsSection>
  );
}

export interface ProvidersSectionProps {
  serverId: string;
}

export function ProvidersSection({ serverId }: ProvidersSectionProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const isConnected = useHostRuntimeIsConnected(serverId);
  const client = useHostRuntimeClient(serverId);
  const supportsProviderRemoval = useHostFeature(serverId, "providerRemoval");
  const supportsProviderAccounts = useHostFeature(serverId, "providerAccounts");
  const { entries, isLoading, refresh } = useProvidersSnapshot(serverId);
  const { config, patchConfig } = useDaemonConfig(serverId);
  const openProviderSettings = useProviderSettingsStore((state) => state.open);
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);
  const [removingProviderId, setRemovingProviderId] = useState<string | null>(null);
  const removingProviderIdRef = useRef<string | null>(null);
  const [installingProviderId, setInstallingProviderId] = useState<string | null>(null);
  const [creatingAccountBase, setCreatingAccountBase] = useState<string | null>(null);
  const [authChooserBase, setAuthChooserBase] = useState<string | null>(null);
  const [apiKeyBase, setApiKeyBase] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [loggingInProviderId, setLoggingInProviderId] = useState<string | null>(null);
  const [loggingOutProviderId, setLoggingOutProviderId] = useState<string | null>(null);
  const [pendingLogins, setPendingLogins] = useState<Record<string, PendingAccountLogin>>({});
  const [renamingProviderId, setRenamingProviderId] = useState<string | null>(null);
  const [optimisticOrderIds, setOptimisticOrderIds] = useState<string[] | null>(null);

  const providerDefinitions = useMemo(
    () =>
      orderProviderDefinitions(
        buildProviderDefinitions(entries),
        config?.providers,
        optimisticOrderIds,
      ),
    [config?.providers, entries, optimisticOrderIds],
  );

  useEffect(() => {
    if (!optimisticOrderIds) return;
    const orderedFromConfig = orderProviderDefinitions(
      buildProviderDefinitions(entries),
      config?.providers,
      null,
    ).map((definition) => definition.id);
    if (
      orderedFromConfig.length === optimisticOrderIds.length &&
      orderedFromConfig.every((providerId, index) => providerId === optimisticOrderIds[index])
    ) {
      setOptimisticOrderIds(null);
    }
  }, [config?.providers, entries, optimisticOrderIds]);

  const hasServer = serverId.length > 0;

  const handleOpenProviderSettings = useCallback(
    (providerId: string) => {
      openProviderSettings({ serverId, provider: providerId });
    },
    [openProviderSettings, serverId],
  );

  const handleToggleEnabled = useCallback(
    async (providerId: string, enabled: boolean) => {
      setPendingProviderId(providerId);
      try {
        await patchConfig({ providers: { [providerId]: { enabled } } });
      } catch (error) {
        Alert.alert(
          t("settings.providers.updateErrorTitle"),
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setPendingProviderId((current) => (current === providerId ? null : current));
      }
    },
    [patchConfig, t],
  );

  const handleProviderDragEnd = useCallback(
    (orderedDefinitions: ProviderDefinition[]) => {
      const currentIds = providerDefinitions.map((definition) => definition.id);
      const orderedIds = orderedDefinitions.map((definition) => definition.id);
      if (
        currentIds.length === orderedIds.length &&
        currentIds.every((providerId, index) => providerId === orderedIds[index])
      ) {
        return;
      }
      // Only patch providers the daemon can persist: builtins and ids that already
      // have a config entry. Runtime-only providers (dev mock providers) have no
      // config entry, and creating one with just `order` fails persisted-config
      // validation ("custom provider must declare extends/label"), which would
      // reject the whole patch.
      const persistableIds = new Set<string>([
        ...BUILTIN_PROVIDER_IDS,
        ...Object.keys(config?.providers ?? {}),
      ]);
      const providers = Object.fromEntries(
        orderedIds
          .filter((providerId) => persistableIds.has(providerId))
          .map((providerId, order) => [providerId, { order }]),
      );
      if (Object.keys(providers).length === 0) {
        return;
      }
      // Keep the list in the dropped order while patchConfig + snapshot catch up.
      // Drag state clears before those updates, so without this the row snaps back.
      setOptimisticOrderIds(orderedIds);
      void patchConfig({ providers }).catch((error: unknown) => {
        setOptimisticOrderIds(null);
        Alert.alert(
          t("settings.providers.updateErrorTitle"),
          error instanceof Error ? error.message : String(error),
        );
      });
    },
    [config?.providers, patchConfig, providerDefinitions, t],
  );

  const handleRemoveProvider = useCallback(
    async (providerId: string, providerLabel: string) => {
      if (removingProviderIdRef.current) return;
      removingProviderIdRef.current = providerId;
      setRemovingProviderId(providerId);
      try {
        const isAccount = isProviderAccountId(config, providerId);
        const confirmed = await confirmDialog({
          title: t("settings.providers.remove.confirmTitle", { name: providerLabel }),
          message: isAccount
            ? t("settings.providers.accounts.removeConfirmMessage")
            : t("settings.providers.remove.confirmMessage"),
          confirmLabel: t("settings.providers.remove.confirm"),
          destructive: true,
        });
        if (!confirmed) {
          return;
        }

        if (isAccount && client) {
          const result = await client.removeProviderAccount({ providerId });
          if (result.error) {
            throw new Error(result.error.message);
          }
          await refresh();
        } else {
          await patchConfig({ removeProviders: [providerId] });
        }
        setPendingLogins((current) => {
          if (!(providerId in current)) {
            return current;
          }
          const next = { ...current };
          delete next[providerId];
          return next;
        });
      } catch (error) {
        Alert.alert(
          t("settings.providers.remove.errorTitle"),
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        if (removingProviderIdRef.current === providerId) {
          removingProviderIdRef.current = null;
        }
        setRemovingProviderId((current) => (current === providerId ? null : current));
      }
    },
    [client, config, patchConfig, refresh, t],
  );

  const copyAccountLoginCode = useCallback(async (loginCode: string): Promise<boolean> => {
    try {
      await copyToClipboard(loginCode);
      return true;
    } catch {
      return false;
    }
  }, []);

  const openAccountLoginPage = useCallback(
    async (pending: PendingAccountLogin) => {
      // Re-copy immediately before leaving Vincu so Cmd/Ctrl+V works on the
      // OpenAI page even if something else replaced the clipboard meanwhile.
      if (pending.loginCode) {
        const copied = await copyAccountLoginCode(pending.loginCode);
        if (copied) {
          toast.show(
            t("settings.providers.accounts.loginCodeCopiedToast", { code: pending.loginCode }),
            {
              variant: "success",
              durationMs: 5_000,
            },
          );
        }
      }
      if (pending.loginUrl) {
        await openExternalUrl(pending.loginUrl);
      }
    },
    [copyAccountLoginCode, t, toast],
  );

  const presentProviderAccountLogin = useCallback(
    async (
      providerId: string,
      result: {
        message?: string | null;
        loginUrl?: string | null;
        loginCode?: string | null;
      },
    ) => {
      const loginUrl = result.loginUrl ?? null;
      const loginCode = result.loginCode ?? null;
      const pending = { loginUrl, loginCode };
      setPendingLogins((current) => ({
        ...current,
        [providerId]: pending,
      }));

      if (!loginUrl && !loginCode) {
        toast.show(result.message ?? t("settings.providers.accounts.loginStartedTitle"), {
          variant: "info",
          durationMs: 5_000,
        });
        return;
      }

      // Auto-copy + open. The code also stays on the account row if paste fails.
      await openAccountLoginPage(pending);
    },
    [openAccountLoginPage, t, toast],
  );

  const handleLoginProviderAccount = useCallback(
    async (providerId: string) => {
      if (!client || loggingInProviderId || loggingOutProviderId) return;
      setLoggingInProviderId(providerId);
      try {
        const result = await client.loginProviderAccount({ providerId });
        if (result.error) {
          throw new Error(result.error.message);
        }
        await presentProviderAccountLogin(providerId, result);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setLoggingInProviderId((current) => (current === providerId ? null : current));
      }
    },
    [client, loggingInProviderId, loggingOutProviderId, presentProviderAccountLogin, toast],
  );

  const handleLogoutProviderAccount = useCallback(
    async (providerId: string, providerLabel: string) => {
      if (!client || loggingOutProviderId || loggingInProviderId) return;
      const confirmed = await confirmDialog({
        title: t("settings.providers.accounts.logoutConfirmTitle", { name: providerLabel }),
        message: t("settings.providers.accounts.logoutConfirmMessage"),
        confirmLabel: t("settings.providers.actions.logout"),
        destructive: true,
      });
      if (!confirmed) {
        return;
      }

      setLoggingOutProviderId(providerId);
      try {
        const result = await client.logoutProviderAccount({ providerId });
        if (result.error) {
          throw new Error(result.error.message);
        }
        setPendingLogins((current) => {
          if (!(providerId in current)) {
            return current;
          }
          const next = { ...current };
          delete next[providerId];
          return next;
        });
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setLoggingOutProviderId((current) => (current === providerId ? null : current));
      }
    },
    [client, loggingInProviderId, loggingOutProviderId, refresh, t, toast],
  );

  const handleCopyLoginCode = useCallback(
    (providerId: string) => {
      const code = pendingLogins[providerId]?.loginCode;
      if (!code) return;
      void copyAccountLoginCode(code).then((copied) => {
        if (copied) {
          toast.show(t("settings.providers.accounts.loginCodeCopiedToast", { code }), {
            variant: "success",
            durationMs: 5_000,
          });
          return undefined;
        }
        toast.error(t("settings.providers.accounts.loginErrorTitle"));
        return undefined;
      });
    },
    [copyAccountLoginCode, pendingLogins, t, toast],
  );

  const handleOpenRenameProvider = useCallback((providerId: string) => {
    setRenamingProviderId(providerId);
  }, []);

  const handleCloseRenameProvider = useCallback(() => {
    setRenamingProviderId(null);
  }, []);

  const renamingProviderLabel = useMemo(() => {
    if (!renamingProviderId) return "";
    return (
      providerDefinitions.find((definition) => definition.id === renamingProviderId)?.label ??
      renamingProviderId
    );
  }, [providerDefinitions, renamingProviderId]);

  const handleRenameProvider = useCallback(
    async (nextLabel: string) => {
      if (!renamingProviderId) return;
      const label = nextLabel.trim();
      if (label.length === 0) return;
      try {
        await patchConfig({ providers: { [renamingProviderId]: { label } } });
        await refresh([renamingProviderId]);
        setRenamingProviderId(null);
      } catch (error) {
        Alert.alert(
          t("settings.providers.rename.errorTitle"),
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    },
    [patchConfig, refresh, renamingProviderId, t],
  );

  const handleOpenLoginPage = useCallback(
    (providerId: string) => {
      const pending = pendingLogins[providerId];
      if (!pending) return;
      void openAccountLoginPage(pending).catch((error) => {
        toast.error(error instanceof Error ? error.message : String(error));
      });
    },
    [openAccountLoginPage, pendingLogins, toast],
  );

  const resetAddFlow = useCallback(() => {
    setAuthChooserBase(null);
    setApiKeyBase(null);
    setApiKeyDraft("");
  }, []);

  const handleCreateOauthAccount = useCallback(
    async (base: ProviderAccountBase) => {
      if (!client || creatingAccountBase) return;
      setCreatingAccountBase(base);
      try {
        const label = nextDefaultProviderAccountLabel(base, config);
        const created = await client.createProviderAccount({
          base,
          label,
          authMode: "oauth",
        });
        if (created.error || !created.providerId) {
          throw new Error(created.error?.message ?? "Failed to create account");
        }
        resetAddFlow();
        await refresh([created.providerId]);
        const login = await client.loginProviderAccount({ providerId: created.providerId });
        if (login.error) {
          throw new Error(login.error.message);
        }
        await presentProviderAccountLogin(created.providerId, login);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setCreatingAccountBase(null);
      }
    },
    [
      client,
      config,
      creatingAccountBase,
      presentProviderAccountLogin,
      refresh,
      resetAddFlow,
      toast,
    ],
  );

  const handleCreateApiKeyInstance = useCallback(
    async (base: string, apiKey?: string) => {
      if (!client || creatingAccountBase) return;
      setCreatingAccountBase(base);
      try {
        const label = nextDefaultProviderAccountLabel(base, config);
        const created = await client.createProviderAccount({
          base,
          label,
          authMode: "api_key",
          apiKey,
        });
        if (created.error || !created.providerId) {
          throw new Error(created.error?.message ?? "Failed to create provider");
        }
        resetAddFlow();
        await refresh([created.providerId]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setCreatingAccountBase(null);
      }
    },
    [client, config, creatingAccountBase, refresh, resetAddFlow, toast],
  );

  const handleSelectBuiltinProvider = useCallback(
    (entry: (typeof ADDABLE_BUILTIN_PROVIDERS)[number]) => {
      if (creatingAccountBase) return;
      if (entry.supportsOauth && entry.supportsApiKey) {
        setApiKeyBase(null);
        setApiKeyDraft("");
        setAuthChooserBase(entry.id);
        return;
      }
      if (entry.supportsApiKey) {
        setAuthChooserBase(null);
        setApiKeyBase(entry.id);
        setApiKeyDraft("");
        return;
      }
      void handleCreateApiKeyInstance(entry.id);
    },
    [creatingAccountBase, handleCreateApiKeyInstance],
  );

  const handleAuthChooserSignIn = useCallback(() => {
    if (!authChooserBase || !isProviderAccountBase(authChooserBase)) return;
    void handleCreateOauthAccount(authChooserBase);
  }, [authChooserBase, handleCreateOauthAccount]);

  const handleAuthChooserApiKey = useCallback(() => {
    if (!authChooserBase) return;
    setApiKeyBase(authChooserBase);
    setApiKeyDraft("");
    setAuthChooserBase(null);
  }, [authChooserBase]);

  const handleSubmitApiKey = useCallback(() => {
    if (!apiKeyBase) return;
    const trimmed = apiKeyDraft.trim();
    if (trimmed.length === 0) {
      toast.error(t("settings.providers.apiKeyPlaceholder"));
      return;
    }
    void handleCreateApiKeyInstance(apiKeyBase, trimmed);
  }, [apiKeyBase, apiKeyDraft, handleCreateApiKeyInstance, t, toast]);

  useEffect(() => {
    if (!client || !supportsProviderAccounts || !config) {
      return;
    }
    const accountIds = Object.keys(config.providers ?? {}).filter((providerId) =>
      isProviderAccountId(config, providerId),
    );
    if (accountIds.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await Promise.all(
        accountIds.map(async (providerId) => {
          try {
            await client.getProviderAccountStatus({ providerId });
          } catch {
            // Status is best-effort for email display.
          }
        }),
      );
      if (!cancelled) {
        await refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, config, refresh, supportsProviderAccounts]);

  useEffect(() => {
    if (!entries) {
      return;
    }
    setPendingLogins((current) => {
      let changed = false;
      const next = { ...current };
      for (const [providerId, pending] of Object.entries(current)) {
        const entry = entries.find((candidate) => candidate.provider === providerId);
        if (entry?.accountEmail || !pending) {
          delete next[providerId];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [entries]);

  const handleInstall = useCallback(
    async (entry: AcpProviderCatalogItem) => {
      if (installingProviderId) return;
      setInstallingProviderId(entry.id);
      try {
        await patchConfig(buildAcpProviderConfigPatch(entry));
        await refresh([entry.id]);
      } catch (error) {
        Alert.alert(
          t("settings.providers.addErrorTitle"),
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setInstallingProviderId((current) => (current === entry.id ? null : current));
      }
    },
    [installingProviderId, patchConfig, refresh, t],
  );

  const renderProviderRow = useCallback(
    ({
      item: def,
      index,
      drag,
      isActive,
      dragHandleProps,
    }: DraggableRenderItemInfo<ProviderDefinition>) => {
      const entry = entries?.find((candidate) => candidate.provider === def.id);
      if (!entry) {
        return <View />;
      }
      const accountBase =
        entry.accountBase && isProviderAccountBase(entry.accountBase)
          ? entry.accountBase
          : resolveProviderAccountBase(config, def.id);
      const isAccount = accountBase !== null;
      const showRename = isAccount || (supportsProviderRemoval && entry.source === "custom");
      return (
        <ProviderRow
          def={def}
          entry={entry}
          enabled={entry.enabled ?? true}
          isToggling={pendingProviderId === def.id}
          isRemoving={removingProviderId === def.id}
          isLoggingIn={loggingInProviderId === def.id}
          isLoggingOut={loggingOutProviderId === def.id}
          canRemove={
            isAccount
              ? supportsProviderAccounts
              : supportsProviderRemoval && entry.source === "custom"
          }
          showLogin={supportsProviderAccounts && isAccount}
          showAccountMenu={supportsProviderAccounts && isAccount && Boolean(entry.accountEmail)}
          showRename={showRename}
          pendingLogin={pendingLogins[def.id] ?? null}
          accountBase={accountBase}
          isFirst={index === 0}
          isActive={isActive}
          drag={drag}
          dragHandleProps={dragHandleProps}
          onPress={handleOpenProviderSettings}
          onToggleEnabled={handleToggleEnabled}
          onLogin={handleLoginProviderAccount}
          onRename={handleOpenRenameProvider}
          onLogout={handleLogoutProviderAccount}
          onCopyLoginCode={handleCopyLoginCode}
          onOpenLoginPage={handleOpenLoginPage}
          onRemove={handleRemoveProvider}
        />
      );
    },
    [
      config,
      entries,
      handleCopyLoginCode,
      handleLoginProviderAccount,
      handleLogoutProviderAccount,
      handleOpenLoginPage,
      handleOpenProviderSettings,
      handleOpenRenameProvider,
      handleRemoveProvider,
      handleToggleEnabled,
      loggingInProviderId,
      loggingOutProviderId,
      pendingLogins,
      pendingProviderId,
      removingProviderId,
      supportsProviderAccounts,
      supportsProviderRemoval,
    ],
  );

  const providerKeyExtractor = useCallback((definition: ProviderDefinition) => definition.id, []);

  return (
    <>
      <SettingsSection
        title={t("settings.providers.title")}
        testID="host-page-providers-card"
        style={styles.sectionSpacing}
      >
        {!hasServer || !isConnected ? (
          <View style={[settingsStyles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>{t("settings.providers.unavailable")}</Text>
          </View>
        ) : null}
        {hasServer && isConnected && isLoading ? (
          <View style={[settingsStyles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>{t("settings.providers.loading")}</Text>
          </View>
        ) : null}
        {hasServer && isConnected && !isLoading && providerDefinitions.length === 0 ? (
          <View style={[settingsStyles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>{t("settings.providers.emptyList")}</Text>
          </View>
        ) : null}
        {hasServer && isConnected && !isLoading && providerDefinitions.length > 0 ? (
          <View style={settingsStyles.card}>
            <DraggableList
              data={providerDefinitions}
              keyExtractor={providerKeyExtractor}
              renderItem={renderProviderRow}
              onDragEnd={handleProviderDragEnd}
              scrollEnabled={false}
              useDragHandle
              testID="provider-list"
              containerStyle={styles.providerList}
            />
          </View>
        ) : null}
      </SettingsSection>

      {hasServer && isConnected ? (
        <AddProviderCard
          serverId={serverId}
          supportsProviderAccounts={supportsProviderAccounts}
          creatingAccountBase={creatingAccountBase}
          authChooserBase={authChooserBase}
          apiKeyBase={apiKeyBase}
          apiKeyDraft={apiKeyDraft}
          installingProviderId={installingProviderId}
          onSelectBuiltin={handleSelectBuiltinProvider}
          onAuthSignIn={handleAuthChooserSignIn}
          onAuthApiKey={handleAuthChooserApiKey}
          onResetAddFlow={resetAddFlow}
          onApiKeyDraftChange={setApiKeyDraft}
          onSubmitApiKey={handleSubmitApiKey}
          onInstall={handleInstall}
        />
      ) : null}

      <AdaptiveRenameModal
        visible={renamingProviderId !== null}
        title={t("settings.providers.rename.title")}
        initialValue={renamingProviderLabel}
        submitLabel={t("settings.providers.rename.submit")}
        onClose={handleCloseRenameProvider}
        onSubmit={handleRenameProvider}
        testID="provider-rename-modal"
      />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  sectionSpacing: {
    marginBottom: theme.spacing[4],
  },
  addProviderSection: {
    marginTop: theme.spacing[4],
  },
  addProviderStack: {
    gap: theme.spacing[3],
  },
  addProviderHeading: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  catalogHeading: {
    marginTop: theme.spacing[2],
  },
  accountActions: {
    gap: theme.spacing[2],
    flexDirection: "row",
    flexWrap: "wrap",
  },
  authChooserCard: {
    padding: theme.spacing[3],
    gap: theme.spacing[3],
  },
  authChooserTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  accountEmailMuted: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing[0.5],
    fontStyle: "italic",
  },
  loginCodeHint: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing[0.5],
    fontVariant: ["tabular-nums"],
  },
  emptyCard: {
    padding: theme.spacing[4],
    alignItems: "center",
  },
  emptyText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  providerList: {
    flexGrow: 0,
  },
  row: {
    gap: theme.spacing[3],
    minHeight: 56,
    alignItems: "center",
  },
  rowDragging: {
    backgroundColor: theme.colors.surface2,
  },
  rowPressable: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    justifyContent: "center",
  },
  rowHovered: {
    backgroundColor: theme.colors.surface2,
  },
  rowPressed: {
    backgroundColor: theme.colors.surface3,
  },
  dragHandle: {
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[1],
    justifyContent: "center",
    alignItems: "center",
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  companyLabel: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    flexShrink: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1.5],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  separator: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  errorText: {
    color: theme.colors.palette.red[300],
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing[1],
  },
  trailingControls: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: theme.spacing[2],
  },
  kebabTrigger: {
    padding: theme.spacing[1],
    borderRadius: theme.borderRadius.base,
  },
  kebabTriggerHovered: {
    backgroundColor: theme.colors.surface2,
  },
}));
