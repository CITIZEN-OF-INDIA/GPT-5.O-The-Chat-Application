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

export function isEffectivelyOnline() {
  if (typeof navigator === "undefined") return true;
  if (isDesktopFileContext()) return true;
  return navigator.onLine;
}

export function resolveApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const envBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (envBase && isValidUrl(envBase)) {
    return new URL(pathOrUrl, envBase).toString();
  }

  if (isDesktopFileContext()) {
    return new URL(pathOrUrl, DEFAULT_REMOTE_API_BASE).toString();
  }

  return pathOrUrl;
}

export function resolveSocketUrl() {
  const envWs = normalizeSocketBase(import.meta.env.VITE_WS_URL || "");
  if (envWs && isValidUrl(envWs)) return envWs;

  if (isDesktopFileContext()) {
    return DEFAULT_REMOTE_API_BASE;
  }

  return undefined;
}
