// Resolve the name for a session being loaded on desktop. Desktop sessions
// always arrive already named — new sessions are timestamped at creation and
// reopened sessions carry their saved name — so an existing name is returned
// unchanged. A timestamp is only synthesized when no name is present; it must
// never be re-appended to an existing name, which made names grow without bound
// on every reopen.
export function resolveSessionName(defaultSession: { name?: string }) {
  return defaultSession.name || `New session ${new Date().toLocaleString()}`
}
