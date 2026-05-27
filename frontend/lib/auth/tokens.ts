const REFRESH_KEY = "minierp_refresh";
const AUTH_COOKIE = "minierp_auth";

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    sessionStorage.setItem(REFRESH_KEY, token);
    document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax`;
  } else {
    sessionStorage.removeItem(REFRESH_KEY);
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function clearTokens() {
  setAccessToken(null);
  setRefreshToken(null);
}

export function hasAuthSession() {
  if (typeof window === "undefined") return false;
  return Boolean(getRefreshToken());
}
