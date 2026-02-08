export const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export function apiUrl(path) {
  // path: "/summary" みたいに先頭 / で渡す想定
  return `${API_BASE}${path}`;
}