const DEFAULT_LOCAL_API_BASE = "http://localhost:4000";
const DEFAULT_REMOTE_API_BASE = "https://gpt-5-o-the-chat-application.onrender.com";

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "ws:" ||
      parsed.protocol === "wss:"
    );
  } catch {
    return false;
  }
}

function normalizeSocketBase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^ws:\/\/https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^ws:\/\//i, "");
  }

  return trimmed;
}

function isDesktopFileContext() {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "file:" &&
    Boolean((window as any).desktop?.isDesktop)
  );
}

function isCapacitorContext() {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "capacitor:" ||
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  );
}

export function isEffectivelyOnline() {
  if (typeof navigator === "undefined") return true;
  if (isDesktopFileContext() || isCapacitorContext()) return true;
  return navigator.onLine;
}

export function resolveApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const envBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (envBase && isValidUrl(envBase)) {
    return new URL(pathOrUrl, envBase).toString();
  }

  if (isDesktopFileContext() || isCapacitorContext()) {
    return new URL(pathOrUrl, DEFAULT_REMOTE_API_BASE).toString();
  }

  return pathOrUrl;
}

export function resolveSocketUrl() {
  const envWs = normalizeSocketBase(import.meta.env.VITE_WS_URL || "");
  if (envWs && isValidUrl(envWs)) {
    const url = new URL(envWs);
    const isHttpsPage =
      typeof window !== "undefined" && window.location.protocol === "https:";
    const isLocalWsHost =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (url.protocol === "ws:" && (isHttpsPage || !isLocalWsHost)) {
      url.protocol = "wss:";
    }

    return url.toString();
  }

  if (isDesktopFileContext() || isCapacitorContext()) {
    return DEFAULT_REMOTE_API_BASE;
  }

  return undefined;
}
