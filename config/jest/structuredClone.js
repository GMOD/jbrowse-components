// Only shim when the test realm genuinely lacks `structuredClone`. A JSON
// round-trip is NOT equivalent: it accepts things the real algorithm rejects (a
// mobx Proxy, a function) and silently rewrites others (Map/Set/Date ->
// {}, undefined-valued keys dropped, NaN -> null). Unconditionally clobbering a
// faithful implementation with it turns every "does this survive postMessage /
// electron IPC" assertion into a test of the shim, which is how a DataCloneError
// from a promoted object config default went unnoticed (see
// BaseSession.preferencesOverrides).
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = val =>
    val === undefined ? undefined : JSON.parse(JSON.stringify(val))
}
