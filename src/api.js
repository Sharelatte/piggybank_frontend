// src/api.js

const BASE = import.meta.env.VITE_API_BASE || "/api";

// "/summary?..." みたいなのを渡すと BASE と結合してくれる
export function apiUrl(path) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${BASE}${path}`;
}

export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

// JSON前提のAPI呼び出し（401なら呼び出し元でログアウト等）
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // bodyがある時はJSONとして送るのが多いので補助（必要な時だけ）
  const res = await fetch(apiUrl(path), { ...options, headers });
  return res;
}