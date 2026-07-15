// Timestamped name for a brand-new session. Single source of truth so every
// launch path (open-sequence, hub configs, resolveSessionName) formats the
// name identically instead of drifting between locales.
export function newSessionName() {
  return `New session ${new Date().toLocaleString('en-US')}`
}

// Resolve the name for a session being loaded on desktop. Desktop sessions
// always arrive already named — new sessions are timestamped at creation and
// reopened sessions carry their saved name — so an existing name is returned
// unchanged. A timestamp is only synthesized when no name is present; it must
// never be re-appended to an existing name, which made names grow without bound
// on every reopen.
export function resolveSessionName(defaultSession: { name?: string }) {
  return defaultSession.name || newSessionName()
}
