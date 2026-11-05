---
name: url-params-consumed-but-not-applied
description: A `hubURL` beside `extendSession` is stripped from the address bar by a loader branch that never used it, and which of the two should win is a product call.
---

# Params consumed and then discarded

`stripConsumedSessionParams` deletes every name in `consumedParams`
(`createSessionLoader.ts`) once the loader is committed, unconditionally. A
branch that ignores a param therefore takes it out of the address bar anyway,
so a reload cannot recover it and the user has no artefact showing what was
dropped. One place still does.

## `hubURL` beside `extendSession`

`loadSessionByType` orders `extendDefaultSession && isJb1StyleSession` above
`isHubSession`, with a comment saying the hub branch "would otherwise replace
that defaultSession outright". So `?hubURL=…&extendSession=true&loc=…` sets
`{type: 'default'}`, the hub never connects, and `hubURL` is stripped.

The ordering is deliberate and the conflict is real: `extendSession` names the
*config's* defaultSession as the thing to layer onto, and a hub brings its own
assemblies and tracks. Both cannot be the base. What is not defensible is doing
it silently. Three ways out, and picking one is the work:

- **Connect the hub and layer the shorthand onto it.** `decodeHubSpec` already
  applies `viewInit` on top of the hub session, so `extendSession` becomes
  redundant rather than contradictory on this route.
- **Keep the current precedence and say so** — `session.notify` naming the
  dropped param, and leave `hubURL` in the address bar.
- **Refuse the combination** with an error, which is the only option that never
  guesses.
