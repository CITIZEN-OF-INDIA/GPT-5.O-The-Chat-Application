const DEFAULT_LOCAL_API_BASE = "http://localhost:4000";

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
  if (envBase) {
    return new URL(pathOrUrl, envBase).toString();
  }

  if (isDesktopFileContext()) {
    return new URL(pathOrUrl, DEFAULT_LOCAL_API_BASE).toString();
  }

  return pathOrUrl;
}

export function resolveSocketUrl() {
  const envWs = (import.meta.env.VITE_WS_URL || "").trim();
  if (envWs) return envWs;

  if (isDesktopFileContext()) {
    return DEFAULT_LOCAL_API_BASE;
  }

  return undefined;
}
