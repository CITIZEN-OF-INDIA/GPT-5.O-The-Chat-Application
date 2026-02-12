import { isEffectivelyOnline, resolveApiUrl } from "../utils/network";

export async function apiFetch(
  url: string,
  options: RequestInit = {}
) {
  if (!isEffectivelyOnline()) {
    throw new Error("OFFLINE");
  }

  const token = localStorage.getItem("token");

  // 🛑 HARD STOP — no token, no request
  if (!token) {
    throw new Error("NO_AUTH");
  }

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Authorization: `Bearer ${token}`,
    },
  });

  // 🛑 AUTH FAILURE MUST NOT RETURN DATA
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem("token");
    throw new Error("UNAUTHORIZED");
  }

  return res;
}
