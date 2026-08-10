---
status: Accepted
summary: "the promotable display-type default cascade resolves at read time and is flattened only in outgoing snapshots; an apply-time model that writes promoted values into open tracks would destroy revert-on-clear"
---

# ADR-063: promotable defaults stay a read-time cascade

## Status

Accepted (2026-07). Recorded after the fact: the decision was made in a branch
and its reasoning lived outside the repo while the implementation landed inside
it.

## Context

A "promotable" display-type default lets a user pin a slot value for a whole
display type, and every open track of that type follows it.
`promotableResolve.ts` resolves each slot through a live cascade:

    the track's own value  →  the session's promoted default  →  the slot base

The promoted defaults live in `preferencesOverrides`, which is `.volatile()`,
personal, and localStorage-backed. They are deliberately never serialized into a
shared session.

The recurring proposal is to make this **apply-time** instead: when a user
promotes a value, write it into every open track, and let reads see ordinary
per-track config. That is simpler to reason about — one value in one place, no
resolution step — and it removes the need for anything to flatten the cascade
later.

## Decision

**Keep the cascade read-time and live.** Do not rewrite it to write promoted
values into open tracks.

Flatten the cascade only at **serialization boundaries**, treating each as
`getComputedStyle`: the outgoing copy carries concrete values, the live session
keeps the cascade. `bakePromotedDefaultsIntoSnapshot`
(`packages/product-core/src/Session/shareableSnapshot.ts`) is that resolver, and
`getShareableSessionSnapshot` pairs snapshotting with baking in one call so the
two cannot be split — a bare `getSnapshot(session)` is never a correct outgoing
snapshot. The worker RPC boundary has its own long-standing equivalent,
`resolvePromotableConfigSnapshot`.

## Consequences

The property this preserves is **retroactive revert-on-clear**: clearing a
promoted default returns every follower to base immediately, because no follower
ever stored the value. Eager-writing destroys that — once the value sits in each
track's config it is indistinguishable from a deliberate per-track edit, so
clearing the pin can only do nothing or clobber real user edits.

The cost is that every boundary handing a session to someone else has to bake.
That reach is `openPromotableDisplays`, literally the same walk the cascade's own
"apply to open tracks" uses, so the set that gets baked and the set that acts on
a promotion cannot drift.

One case is deliberately not covered, and it is why there is no opt-out flag: a
sender sitting at a slot's *base* value bakes nothing (the value equals base, and
`stripDefault` drops it), so a recipient who has promoted something else resolves
their own value. At-base and unset are byte-identical once stripped, so no value
can express "I deliberately saw the default". An earlier version did cover it, by
stamping `ignorePromotedDefaults` on every open display; that was removed because
it needed a second shape-aware walk kept in step with `openPromotableDisplays` by
hand, and it detached received tracks from the recipient's own pins for good. A
promoted default is personal and local — the same status as the theme a session
is viewed in, which is not baked either.

The apply-time rewrite stays available as a *product* decision, if revert-on-clear
is ever judged not load-bearing. It is not an implementation cleanup and should
not be reopened as one.

Tests: `products/jbrowse-web/src/tests/ShareablePromotedDefaults.test.ts`.
