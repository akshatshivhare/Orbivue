const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error("VITE_API_BASE_URL is required in production");
}

export const API_BASE_URL = configuredApiUrl || "http://127.0.0.1:8000";

console.log("[OrbiVue API] base URL:", API_BASE_URL);

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${API_BASE_URL.replace(/\/+$/, "")}${normalizedPath}`;
}
