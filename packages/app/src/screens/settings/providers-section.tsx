import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type PressableStateCallbackType,
} from "react-native";
import { StyleSheet, useUnistyles, withUnistyles } from "react-native-unistyles";
import { useIsCompactFormFactor } from "@/constants/layout";
import { isNative } from "@/constants/platform";
import { settingsStyles } from "@/styles/settings";
import type { Theme } from "@/styles/theme";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { useHostFeature } from "@/runtime/host-features";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import { buildProviderDefinitions } from "@/utils/provider-definitions";
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
  isProviderAccountId,
  nextDefaultProviderAccountLabel,
  providerAccountCompanyName,
  resolveProviderAccountBase,
  type ProviderAccountBase,
} from "@/provider-accounts/is-provider-account";
import {
  ChevronRight,
  Copy,
  ExternalLink,
  LogIn,
  LogOut,
  MoreVertical,
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
const ThemedTrash2 = withUnistyles(Trash2);

const reconnectLeading = <ThemedRefreshCw size={MENU_ICON_SIZE} uniProps={mutedColorMapping} />;
const logoutLeading = <ThemedLogOut size={MENU_ICON_SIZE} uniProps={mutedColorMapping} />;
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
  pendingLogin: PendingAccountLogin | null;
  accountBase: ProviderAccountBase | null;
  isFirst: boolean;
  onPress: (providerId: string) => void;
  onToggleEnabled: (providerId: string, enabled: boolean) => void;
  onLogin: (providerId: string) => void;
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

function UnsignedAccountActions({
  providerId,
  isRemoving,
  isLoggingIn,
  showLogin,
  pendingLogin,
  canRemove,
  onLogin,
  onCopyLoginCode,
  onOpenLoginPage,
  onRemove,
  removeLabel,
}: {
  providerId: string;
  isRemoving: boolean;
  isLoggingIn: boolean;
  showLogin: boolean;
  pendingLogin: PendingAccountLogin | null;
  canRemove: boolean;
  onLogin: (providerId: string) => void;
  onCopyLoginCode: (providerId: string) => void;
  onOpenLoginPage: (providerId: string) => void;
  onRemove: (providerId: string, providerLabel: string) => void;
  removeLabel: string;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const pendingLoginCode = pendingLogin?.loginCode ?? null;
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
  const removeIcon = useMemo(
    () => <Trash2 size={theme.iconSize.sm} color={theme.colors.foreground} />,
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
  const handleRemove = useCallback(() => {
    onRemove(providerId, removeLabel);
  }, [onRemove, providerId, removeLabel]);

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
      {canRemove ? (
        <Button
          variant="outline"
          size="sm"
          leftIcon={removeIcon}
          onPressIn={stopPressInPropagation}
          onPress={handleRemove}
          disabled={isRemoving || isLoggingIn}
          loading={isRemoving}
          testID={`provider-remove-${providerId}`}
        >
          {isRemoving
            ? t("settings.providers.actions.removing")
            : t("settings.providers.actions.remove")}
        </Button>
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
  onLogout: (providerId: string, providerLabel: string) => void;
  onRemove: (providerId: string, providerLabel: string) => void;
  removeLabel: string;
}) {
  const { t } = useTranslation();
  const menuBusy = isLoggingIn || isLoggingOut || isRemoving;
  const handleReconnect = useCallback(() => {
    onLogin(providerId);
  }, [onLogin, providerId]);
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
  pendingLogin,
  canRemove,
  onToggleEnabled,
  onLogin,
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
  pendingLogin: PendingAccountLogin | null;
  canRemove: boolean;
  onToggleEnabled: (providerId: string, enabled: boolean) => void;
  onLogin: (providerId: string) => void;
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
          onLogout={onLogout}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      ) : (
        <UnsignedAccountActions
          providerId={providerId}
          isRemoving={isRemoving}
          isLoggingIn={isLoggingIn}
          showLogin={showLogin}
          pendingLogin={pendingLogin}
          canRemove={canRemove}
          onLogin={onLogin}
          onCopyLoginCode={onCopyLoginCode}
          onOpenLoginPage={onOpenLoginPage}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      )}
    </View>
  );
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
  pendingLogin,
  accountBase,
  isFirst,
  onPress,
  onToggleEnabled,
  onLogin,
  onLogout,
  onCopyLoginCode,
  onOpenLoginPage,
  onRemove,
}: ProviderRowProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const isCompact = useIsCompactFormFactor();
  const resolvedAccountBase =
    accountBase ??
    (entry.accountBase === "claude" || entry.accountBase === "codex" ? entry.accountBase : null);
  const isAccount = resolvedAccountBase !== null;
  const isAccountSignedIn = Boolean(entry.accountEmail);
  const showEnableToggle = !isAccount || isAccountSignedIn;
  const effectiveEnabled = showEnableToggle ? enabled : false;
  const title = isAccount ? providerAccountCompanyName(resolvedAccountBase) : def.label;
  const pendingLoginCode = pendingLogin?.loginCode ?? null;
  const subtitle = resolveAccountSubtitle({
    isAccount,
    pendingLoginCode,
    accountEmail: entry.accountEmail,
    t,
  });
  const subtitleStyle = resolveAccountSubtitleStyle({
    pendingLoginCode,
    isAccount,
    hasAccountEmail: Boolean(entry.accountEmail),
  });
  const removeLabel = entry.accountEmail ? `${title} (${entry.accountEmail})` : title;
  const ProviderIcon = getProviderIcon(resolvedAccountBase ?? def.id);
  const providerError =
    effectiveEnabled &&
    entry.status === "error" &&
    typeof entry.error === "string" &&
    entry.error.trim().length > 0
      ? entry.error.trim()
      : null;
  const modelCount = filterSelectableModels(entry.models ?? null)?.length ?? 0;
  const providerStatus = getProviderStatus(entry.status, effectiveEnabled, modelCount, t);
  const accessibilityName = subtitle ? `${title}, ${subtitle}` : title;

  const handlePress = useCallback(() => {
    onPress(def.id);
  }, [def.id, onPress]);
  const rowStyle = useCallback(
    ({ pressed, hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
      settingsStyles.row,
      !isFirst && settingsStyles.rowBorder,
      styles.row,
      hovered && styles.rowHovered,
      pressed && styles.rowPressed,
    ],
    [isFirst],
  );

  return (
    <Pressable
      style={rowStyle}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t("settings.providers.providerDetails", { name: accessibilityName })}
    >
      {({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => (
        <>
          <View style={styles.rowContent}>
            <ChevronRight
              size={theme.iconSize.sm}
              color={hovered ? theme.colors.foreground : theme.colors.foregroundMuted}
            />
            <ProviderIcon size={theme.iconSize.md} color={theme.colors.foreground} />
            <View style={styles.textColumn}>
              <View style={styles.titleRow}>
                <Text style={settingsStyles.rowTitle} numberOfLines={1}>
                  {title}
                </Text>
                {!isCompact ? <Text style={styles.separator}>·</Text> : null}
                <StatusIndicator status={providerStatus} compact={isCompact} />
              </View>
              {subtitle ? (
                <Text
                  style={subtitleStyle}
                  numberOfLines={1}
                  testID={pendingLoginCode ? `provider-login-code-${def.id}` : undefined}
                >
                  {subtitle}
                </Text>
              ) : null}
              {providerError && !isCompact ? (
                <Text style={styles.errorText} numberOfLines={3}>
                  {providerError}
                </Text>
              ) : null}
            </View>
          </View>
          <ProviderRowActions
            providerId={def.id}
            title={title}
            showEnableToggle={showEnableToggle}
            effectiveEnabled={effectiveEnabled}
            isToggling={isToggling}
            isRemoving={isRemoving}
            isLoggingIn={isLoggingIn}
            isLoggingOut={isLoggingOut}
            showLogin={showLogin}
            showAccountMenu={showAccountMenu}
            pendingLogin={pendingLogin}
            canRemove={canRemove}
            onToggleEnabled={onToggleEnabled}
            onLogin={onLogin}
            onLogout={onLogout}
            onCopyLoginCode={onCopyLoginCode}
            onOpenLoginPage={onOpenLoginPage}
            onRemove={onRemove}
            removeLabel={removeLabel}
          />
        </>
      )}
    </Pressable>
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
  const [creatingAccountBase, setCreatingAccountBase] = useState<"claude" | "codex" | null>(null);
  const [loggingInProviderId, setLoggingInProviderId] = useState<string | null>(null);
  const [loggingOutProviderId, setLoggingOutProviderId] = useState<string | null>(null);
  const [pendingLogins, setPendingLogins] = useState<Record<string, PendingAccountLogin>>({});

  const providerDefinitions = useMemo(() => buildProviderDefinitions(entries), [entries]);
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

  const handleCreateProviderAccount = useCallback(
    async (base: "claude" | "codex") => {
      if (!client || creatingAccountBase) return;
      setCreatingAccountBase(base);
      try {
        const label = nextDefaultProviderAccountLabel(base, config);
        const created = await client.createProviderAccount({ base, label });
        if (created.error || !created.providerId) {
          throw new Error(created.error?.message ?? "Failed to create account");
        }
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
    [client, config, creatingAccountBase, presentProviderAccountLogin, refresh, toast],
  );

  const handleCreateClaudeAccount = useCallback(() => {
    void handleCreateProviderAccount("claude");
  }, [handleCreateProviderAccount]);

  const handleCreateCodexAccount = useCallback(() => {
    void handleCreateProviderAccount("codex");
  }, [handleCreateProviderAccount]);

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
        {hasServer && isConnected && !isLoading && providerDefinitions.length > 0 ? (
          <View style={settingsStyles.card}>
            {providerDefinitions.map((def, index) => {
              const entry = entries?.find((candidate) => candidate.provider === def.id);
              if (!entry) return null;
              const accountBase =
                entry.accountBase === "claude" || entry.accountBase === "codex"
                  ? entry.accountBase
                  : resolveProviderAccountBase(config, def.id);
              const isAccount = accountBase !== null;
              return (
                <ProviderRow
                  key={def.id}
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
                  showAccountMenu={
                    supportsProviderAccounts && isAccount && Boolean(entry.accountEmail)
                  }
                  pendingLogin={pendingLogins[def.id] ?? null}
                  accountBase={accountBase}
                  isFirst={index === 0}
                  onPress={handleOpenProviderSettings}
                  onToggleEnabled={handleToggleEnabled}
                  onLogin={handleLoginProviderAccount}
                  onLogout={handleLogoutProviderAccount}
                  onCopyLoginCode={handleCopyLoginCode}
                  onOpenLoginPage={handleOpenLoginPage}
                  onRemove={handleRemoveProvider}
                />
              );
            })}
          </View>
        ) : null}
      </SettingsSection>

      {hasServer && isConnected ? (
        <SettingsSection
          title={t("settings.providers.accounts.title")}
          testID="host-page-provider-accounts-card"
          style={styles.addProviderSection}
        >
          {supportsProviderAccounts ? (
            <View style={styles.accountActions}>
              <Button
                size="sm"
                variant="secondary"
                disabled={creatingAccountBase !== null}
                onPress={handleCreateClaudeAccount}
                testID="provider-account-add-claude"
              >
                {creatingAccountBase === "claude"
                  ? t("settings.providers.accounts.adding")
                  : t("settings.providers.accounts.addClaude")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={creatingAccountBase !== null}
                onPress={handleCreateCodexAccount}
                testID="provider-account-add-codex"
              >
                {creatingAccountBase === "codex"
                  ? t("settings.providers.accounts.adding")
                  : t("settings.providers.accounts.addCodex")}
              </Button>
            </View>
          ) : (
            <View style={[settingsStyles.card, styles.emptyCard]}>
              <Text style={styles.emptyText}>
                {t("settings.providers.accounts.hostUpdateRequired")}
              </Text>
            </View>
          )}
        </SettingsSection>
      ) : null}

      {hasServer && isConnected ? (
        <SettingsSection
          title={t("settings.providers.addProvider")}
          testID="host-page-add-provider-card"
          style={styles.addProviderSection}
        >
          <ProviderCatalogList
            serverId={serverId}
            installingProviderId={installingProviderId}
            onInstall={handleInstall}
          />
        </SettingsSection>
      ) : null}
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
  accountActions: {
    gap: theme.spacing[2],
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
  row: {
    gap: theme.spacing[3],
    minHeight: 56,
  },
  rowHovered: {
    backgroundColor: theme.colors.surface2,
  },
  rowPressed: {
    backgroundColor: theme.colors.surface3,
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
