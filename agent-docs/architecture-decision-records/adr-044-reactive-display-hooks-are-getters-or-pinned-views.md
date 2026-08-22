---
status: Accepted
summary: "Reactive display hooks are getters where possible, pinned views where not — an `.actions()` block untracks them silently"
---

# ADR-044: Reactive display hooks are getters where possible, and pinned views where not

## Status

Accepted (2026-07). Applies to every overridable hook a display exposes that is
read from an autorun or a computed. Implements the rule stated in
`plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md` and closes the
failure mode behind two shipped bugs.

## Context

MST turns whatever a `.views()` block declares into computeds (getters) or plain
tracked functions (methods), and whatever an `.actions()` block declares into
actions. MobX runs an action inside `untracked`. So a hook declared on the wrong
side still **returns the right value when called** — it just stops registering
the observables it read, and every autorun or computed calling it keeps a stale
answer until something else it happens to depend on changes.

Nothing crashes, nothing logs, and the declaration site is often hundreds of
lines from the block opener that decides its fate. The two hooks exposed to this
are the method-shaped ones read from reactive contexts:

- `isCacheValid(displayedRegionIndex)` — read by the `FetchVisibleRegions`
  autorun.
- `rpcProps()` — read by the `rpcPropsCacheKey` computed.

It has bitten twice:

- **MultiSampleVariant's byte gate was dead.** The gate's old opt-in was a
  method, `getByteEstimateConfig()`, that read `view.visibleBp`. It was declared
  in an `.actions()` block, so the `gateEnabled` computed (then
  `derivedRegionTooLargeEnabled`) that
  called it registered nothing, evaluated once pre-init to `false`, and never
  re-evaluated. Both multi-sample-variant displays fetched unguarded, with
  `derivedRegionTooLarge.test.ts` and `isCacheValidTracking.test.ts` failing on a
  clean checkout.
- **`LinearMultiRowFeatureDisplay.isCacheValid` sat inside a 210-line
  `.actions()` block.** Masked, because `FetchVisibleRegions` independently reads
  `view.visibleRegions` and `regionTooLarge`, so it re-fired and re-called the
  hook anyway. Latent, not visible — which is worse.

The single pre-existing pin covered one display and named the hazard in prose
everywhere else ("don't let this be your only dependency", as the wiggle override
used to warn). Prose does not survive a refactor that moves a method twenty lines
up.

## Decision

**Prefer a getter.** MST throws at instantiation on a getter inside an
`.actions()` block (`action2.bind is not a function`), so a getter cannot regress
this way at all — the mistake becomes a crash on the first display instantiation,
in every test that builds one. Where a hook can be a boolean or a value rather
than a call, make it one. The byte gate's opt-in was reshaped from
`getByteEstimateConfig(): {adapterConfig, visibleBp} | null` to the plain getter
`measuresBytesPreFlight: boolean` for exactly this reason (see
[REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md)); the viewport read moved
inside `byteGateBlocksFetch`, the action that consumes it, where being untracked
is correct.

**Where a hook must take an argument, pin its declaration site.** Every fetching
display family asserted the hook is not an action, via MST's public reflection:

```ts
const { actions } = getMembers(display)
expect(actions).not.toContain('isCacheValid')
expect(actions).not.toContain('rpcProps')
```

Live in alignments, canvas basic, canvas multi-row, MAF, LD,
multi-sample-variant matrix, and wiggle, three lines per new fetching display —
until 2026-08, when the seven copies became one `afterAttach` read and then the
lint selector under "Rejected alternatives" below. The decision above is
unchanged; only where the pin lives is.

## Rejected alternatives

**A shared test helper exported from `@jbrowse/core`.** Three lines of assertion
would become a test-only symbol on core's public surface, reachable by every
plugin forever — the ossification [PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md)
is about. The rationale lives once in `BaseLinearDisplay/CLAUDE.md`; the
assertion is cheap enough to inline where a display instance already exists.

**A lint rule ("no method matching /^(isCacheValid|rpcProps)$/ inside
`.actions()`").** The block a member lands in is a runtime property of a fluent
MST chain, not a syntactic one — a member can be added by a mixin, a helper
factory, or a super-capture override. A lint rule would see the easy cases and
miss precisely the 210-line-block case that shipped.

**Adopted in 2026-08, and this paragraph was mostly wrong.** The rule is a
`no-restricted-syntax` selector in `eslint.config.mjs` and it is now the whole
check; the `afterAttach` read that had replaced the per-family assertions is
gone. Of the three escapes named above, two are plain syntax and are matched: a
mixin declaring the hook is a declaration in the mixin's own file, and a
super-capture override returns its object out of a block body, which the
selector's second arm covers — as does the 210-line block, which is the *easy*
case rather than the hard one, since a member written in an `.actions(…)`
argument is in that block however long the block is. Only the third holds: a
helper factory whose object is spread into `.actions()` puts the declaration in
another file, and no display does that. What none of the three forms ever
covered is an out-of-tree display, which runs neither our lint nor our tests, and
which the production strip already left with nothing.

**`isAction()` from MobX.** Doesn't work: MST wraps actions with its own
mechanism, so `isAction(display.isCacheValid)` is `false` for a real MST action.
`getMembers(instance).actions` is the reflection that reports it, and it
correctly reports an override that landed in `.actions()` even while the base
still declares the view.

**One test over all display types.** Each family's model lives in its own plugin
with its own test environment; importing them into one place is a circular-import
trap. Per-family is also where the failure would be diagnosed.

## Consequences

- New method-shaped hook read from a reactive context? Ask whether it can be a
  getter first. If not, add its name to the `no-restricted-syntax` selector.
- The pin catches the declaration site, not the tracking behavior. Keep the one
  behavioral tracking test (`isCacheValidTracking.test.ts`) — it is what proves
  the *reason* the declaration matters, and it would survive a future MST that
  reports members differently.
- Two hooks are in scope today. `getByteEstimateConfig` is gone; `gateEnabled`,
  `measuresBytesPreFlight`, `gateActive`, `regionTooLarge`, and `densityTooLarge`
  are getters and therefore self-protecting. (The first two were
  `derivedRegionTooLargeEnabled` and `byteGateEnabled` when this was written —
  and note that this list and ADR-045 both already wrote the *third* as
  `gateActive` while the code called it `byteGateActive`, which is roughly the
  whole argument for the 2026-08 rename.)
