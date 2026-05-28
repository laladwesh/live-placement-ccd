/**
 * userCache.js
 * Caches /users/me response in localStorage so pages don't hammer the API.
 * Each call that would hit the API instead checks here first (5-min TTL).
 * The token is stored alongside so switching accounts invalidates the cache.
 */

const CACHE_KEY = 'pp_user_v1';
const TTL_MS    = 5 * 60 * 1000; // 5 minutes

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { user, ts, token } = JSON.parse(raw);
    const currentToken = localStorage.getItem('jwt_token');
    // Invalidate if token changed or cache is stale
    if (token !== currentToken || Date.now() - ts > TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return user || null;
  } catch {
    return null;
  }
}

export function setCachedUser(user) {
  try {
    const token = localStorage.getItem('jwt_token');
    localStorage.setItem(CACHE_KEY, JSON.stringify({ user, ts: Date.now(), token }));
  } catch {}
}

export function clearCachedUser() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

/**
 * Returns cached user immediately if fresh, otherwise fetches from API,
 * caches the result, and returns it. Throws on network/auth error.
 */
export async function fetchCurrentUser(api) {
  const cached = getCachedUser();
  if (cached) return cached;
  const res = await api.get('/users/me');
  const user = res.data.user;
  setCachedUser(user);
  return user;
}
