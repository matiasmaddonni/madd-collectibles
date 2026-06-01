// Client-side session identity for first-party analytics. A session
// survives across page navigations within the same tab and resets
// after a 30-minute idle window — long enough to capture a real
// browsing run, short enough that a returning visitor an hour later
// counts as a new session.
//
// Stored in sessionStorage so it doesn't follow the user across tabs
// (deliberate — separate tabs = separate sessions on this storefront).
// On every read we bump `lastActive`; if the previous read was more
// than IDLE_MS ago, we rotate the id.

const SESSION_KEY = "madd_session_id";
const LAST_ACTIVE_KEY = "madd_session_last_active";
const IDLE_MS = 30 * 60 * 1000;

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — non-RFC4122 but unique enough.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) ?? "0");
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || (last && now - last > IDLE_MS)) {
      id = newSessionId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(now));
    return id;
  } catch {
    // Private mode / blocked storage: degrade to a per-page id.
    return newSessionId();
  }
}
