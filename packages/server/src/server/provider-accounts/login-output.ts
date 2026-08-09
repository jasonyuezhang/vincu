const ANSI_ESCAPE_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g");
const LOGIN_URL_RE = /https:\/\/[^\s"'<>]+/i;
const DEVICE_CODE_LABELED_RE = /one-time code[^\n]*\n\s*([A-Z0-9]{4}-[A-Z0-9]{4,})\b/i;
const DEVICE_CODE_FALLBACK_RE = /\b([A-Z0-9]{4}-[A-Z0-9]{5})\b/;

export interface ProviderAccountLoginHints {
  loginUrl: string | null;
  loginCode: string | null;
}

export function stripAnsi(text: string): string {
  ANSI_ESCAPE_RE.lastIndex = 0;
  return text.replace(ANSI_ESCAPE_RE, "");
}

function trimUrlTrailingPunctuation(url: string): string {
  return url.replace(/[.,);]+$/u, "");
}

export function parseProviderAccountLoginOutput(output: string): ProviderAccountLoginHints {
  const text = stripAnsi(output);
  const urlMatch = text.match(LOGIN_URL_RE);
  const labeledCode = text.match(DEVICE_CODE_LABELED_RE);
  const fallbackCode = labeledCode ? null : text.match(DEVICE_CODE_FALLBACK_RE);

  return {
    loginUrl: urlMatch ? trimUrlTrailingPunctuation(urlMatch[0]) : null,
    loginCode: labeledCode?.[1] ?? fallbackCode?.[1] ?? null,
  };
}

export function buildProviderAccountLoginMessage(hints: ProviderAccountLoginHints): string {
  if (hints.loginUrl && hints.loginCode) {
    return `Open ${hints.loginUrl} and enter code ${hints.loginCode}. Then refresh account status.`;
  }
  if (hints.loginUrl) {
    return `Open ${hints.loginUrl} to sign in, then refresh account status.`;
  }
  return "Login started. Complete the browser flow on this host, then refresh account status.";
}
