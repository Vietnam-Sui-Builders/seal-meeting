/**
 * Authentication token storage utilities
 * Centralized management for access tokens, refresh tokens, and session data
 */

export interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  TOKEN_EXPIRES_AT: 'tokenExpiresAt',
} as const;

/**
 * Get the current access token from storage
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Get the current refresh token from storage
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Get all stored authentication tokens
 */
export function getStoredTokens(): StoredAuthTokens | null {
  if (typeof window === 'undefined') return null;

  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const expiresAt = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);

  if (!accessToken || !refreshToken || !expiresAt) {
    return null;
  }

  return { accessToken, refreshToken, expiresAt };
}

/**
 * Store authentication tokens
 */
export function storeTokens(tokens: StoredAuthTokens): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, tokens.expiresAt);
}

/**
 * Update only the access token (useful after refresh)
 */
export function updateAccessToken(accessToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
}

/**
 * Clear all authentication tokens from storage
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
}

/**
 * Check if the current token is expired or about to expire
 * @param bufferMinutes - Minutes before expiry to consider token expired (default: 5)
 */
export function isTokenExpired(bufferMinutes: number = 5): boolean {
  if (typeof window === 'undefined') return true;

  const expiresAt = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  if (!expiresAt) return true;

  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const buffer = bufferMinutes * 60 * 1000;

  return expiryTime - now < buffer;
}

/**
 * Get the token expiration time as a Date object
 */
export function getTokenExpiry(): Date | null {
  if (typeof window === 'undefined') return null;

  const expiresAt = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  if (!expiresAt) return null;

  return new Date(expiresAt);
}
