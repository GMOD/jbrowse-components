// The `session=` query param that jbrowse-web reads to open a declarative
// session without a saved-session backend: a `spec-` prefix plus the
// URL-encoded JSON. Shared so the runner and screenshot generator can't drift
// on the encoding.
export function encodeSessionSpec(session: object): string {
  return `spec-${encodeURIComponent(JSON.stringify(session))}`
}

// Full `?config=…&session=…&sessionName=…` query string. `config` is inserted
// as-is (callers that point at a remote absolute URL pre-encode it themselves).
export function sessionSpecQuery({
  config,
  session,
  sessionName = 'Screenshot',
}: {
  config: string
  session: object
  sessionName?: string
}): string {
  return `?config=${config}&session=${encodeSessionSpec(session)}&sessionName=${encodeURIComponent(sessionName)}`
}
