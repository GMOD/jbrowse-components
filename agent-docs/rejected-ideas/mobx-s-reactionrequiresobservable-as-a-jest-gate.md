---
name: mobx-s-reactionrequiresobservable-as-a-jest-gate
description: MobX's `reactionRequiresObservable` as a jest gate
area: tooling-tests-and-docs
---

# MobX's `reactionRequiresObservable` as a jest gate

, so an autorun whose
run read no observable — one nothing will ever re-run — fails the test.
Measured 2026-08-23 and declined the same day. The pilot looked clean: over
render-core and BaseLinearDisplay (65 suites) no reaction warned and the only
hits were three constant getters. The full run said what the pilot could not:
**1922 failures across 352 suites**, because the flag governs every
*derivation*, not reactions. The top hits were observer components that
rendered from props alone (`observerTreeItem` 52k, `observerTrackLabel` 44k)
and constant computeds (`LinearAlignmentsDisplay.defaultScoreDomain`,
`LinearGenomeView.minBpPerPx`, every `gateEnabled` default, the session
`root`, anonymous slot computeds) — all correct code. An exemption list would
be the tree. Two things stand in for it: the `reactionDependencies` snapshot
tests state the installers' dependency set per state, and the bug class the
docs describe (a trigger read dropped under a gate) leaves a *non-empty* set
anyway, so the flag would not have seen it. Per-reaction
`autorun(fn, { requiresObservable: true })` is precise but pointless on the
installers, which read their pure signals unconditionally and cannot hit an
empty set. **Reopen only** if MobX gains a reaction-scoped flag.
