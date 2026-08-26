---
status: Rejected
summary: "The comparative displays don't compose `FetchMixin`; the third fetch shape is structural, and everything drift-prone they share with the LGV families is already shared as plain functions"
---

# ADR-054: Comparative displays keep their own fetch; no `SignatureFetchMixin` on `FetchMixin`

## Status

Rejected (2026-08). Retires a long-standing `TODO.md` entry; same genre as
[ADR-042](adr-042-no-shared-assembly-swap-autorun-installer.md), which rejected a
different extraction for this same pair of displays.

## Context

`LinearSyntenyDisplay` and `DotplotDisplay` fetch outside `FetchMixin`: their own
`loading` / `refetching` derivations, no `fetchCanceled` / `cancelFetchByUser`,
no `reload()`. The proposal was a `SignatureFetchMixin` = `FetchMixin` +
`loadedFetchKey` volatile + overridable `currentFetchKey` + `dataCurrent`, with
`installComparativeFetchAutorun` folded onto it the way
`installGlobalFetchAutorun` sits on `GlobalFetchMixin`. The stated payoff was
that the display-stacks table in [ARCHITECTURE.md](../ARCHITECTURE.md#display-stacks)
would become three rows that all compose `FetchMixin`, instead of two rows and a
footnote.

## Decision

**Keep the third shape.** Four independent reasons; any one alone would only be a
caution, but together they say the footnote describes real structure rather than
an unfinished migration.

### 1. The fold does not retire the second stop-token machine

The motivating smell is two latest-wins token rotations — `FetchMixin.runFetch`
and `createStopTokenRotation`. Folding the comparative displays removes neither:
`getMultiSampleVariantSourcesAutorun` (`plugins/variants/src/shared`) uses the
rotation on `MultiSampleVariantBaseModel`, which **already** composes `FetchMixin`
through `MultiRegionDisplayMixin`. It has to, because `FetchMixin` holds a single
`activeStopToken` and can therefore host exactly one in-flight fetch per node,
while the sources fetch is a second concurrent one.

`createStopTokenRotation` is the composable primitive; `FetchMixin` is one
observable wrapper around it for the display's *primary* fetch. A second consumer
of the primitive is not evidence of an unfinished migration.

**2026-08-20: that last sentence is now literally true, and it was not when this
was written.** `FetchMixin.runFetch` reimplemented the rotation rather than
wrapping it — same seven behaviours, twice, including two copies of the ADR-080
supersede rule — and the two had already drifted over whether a completed fetch
releases its token. It is a wrapper now: `begin` / `isCurrent` / `end` /
`cancel`, plus the observable bookkeeping (`isLoading`, `error`,
`fetchGeneration`, `fetchCanceled`). Nothing about the decision below changes;
what changed is that there is one machine, which is what makes the argument in
this section a description rather than a hope.

### 2. `FetchMixin`'s net-new surface is mostly inapplicable or unreachable

- the per-region status fan-out. Both comparative fetches are a single RPC —
  dead weight. (At the time this named three `FetchMixin` members,
  `regionStatuses` / `setRegionStatus` / `makeRegionStatusCallback`; the
  aggregate now lives in `createStatusFanOut` on the fetch context, which
  `createStopTokenRotation` callers can reach for directly. The argument is
  unchanged — a single-RPC fetch has nothing to aggregate.)
- `fetchCanceled` / `cancelFetchByUser` need a cancel affordance to mean
  anything. Neither comparative overlay has one:
  `LinearSyntenyRendering.tsx` passes `LoadingOverlay` no `onCancel`/`onRetry`
  (the component supports both), and `DisplayStatusOverlays.tsx` renders a bare
  `LoadingProgress`. Composing the mixin adds the state, not the feature.
- `reload()` lives on `GlobalFetchMixin`, not `FetchMixin`, and works only
  because `installGlobalFetchAutorun` reads `void self.reloadCounter`. Nothing
  about it requires `FetchMixin`.
- `error` / `statusMessage` / `statusProgress` already arrive from `BaseDisplay`.

What remains is `runFetch` and `isLoading` — a rename of machinery
`installComparativeFetchAutorun` already implements correctly, with the same
staleness discipline.

### 3. The mixin cannot see `error`, and the obvious fix is what ADR-041 forbids

`refetching` (`fetching && ready && !error`) and `loading` both read `self.error`.
`SyntenyFetchStateMixin` is an empty model composed *after* `BaseDisplay`, so it
cannot read `error` — and must not *declare* one: composed later, its volatile
would shadow `BaseDisplay`'s and read `undefined` forever, silently disabling
both getters.

`FetchMixin` gets away with exactly that duplication because it declares the
whole set (`error`, `statusMessage`, `statusProgress`, `setError`,
`setStatusMessage`) and one coherent set wins. Adding a **third** declaration
site for those five members, in order to hoist two one-line getters, is precisely
the silent correctness trap [ADR-041](adr-041-no-mixin-composed-into-basedisplay.md)
records — and it would land on the compose chains that ADR found are already at
MST's type-inference depth budget.

### 4. The shared policy is already shared, as plain functions — the prescribed shape

ADR-041's conclusion is that cross-cutting display policy at this level is a
plain function, not a mixin. Everything drift-prone here already is one:
`isDataCurrent`, `computeSvgReady`, `displaysSettled`, `createStopTokenRotation`,
`createStatusThrottle`, `leadingEdgeAutorun`, `syntenyFetchRegions`,
`swappedAssembliesWarning`, and the entire `installComparativeFetchAutorun`
skeleton — which already owns token rotation, debounce, loading/error flags,
refName reconciliation and the commit-only-if-current rule.

What stays display-local is `dataCurrent` (a one-line `isDataCurrent` call),
`refetching` (one line) and `loading` (one line, and *different* between the two —
synteny subtracts `fetchInert`, dotplot has no inert state). That is wiring over
already-shared policy, differing between the callers in exactly the terms a
hoisted version would have to take as hooks. ADR-042 rejected an extraction for
this same pair on this same bar.

**2026-08-23: the three are one function now, and that is this section's own
conclusion rather than a departure from it.** The reason they stayed local was
that `loading` differed — "dotplot has no inert state" — and the term became
spellable in both: `fetchInert` reached `SyntenyFetchStateMixin` for
`displaysSettled` with a default of `false`, so the dotplot's `loading`
subtracts it exactly as synteny's does. The dotplot did not gain an inert
*state* and still has none — it declares no override, which is why the
subtraction is a no-op there rather than a behavior change. With the last
differing term gone the six getters were character-identical in pairs, which is
duplication with nothing left to parameterize, and the two comments describing
`loading` had already drifted over whether the `fetchInert` subtraction was
hypothetical. `comparativeFetchFlags` (`packages/synteny-core/src`) takes the
display's fetch state and returns the three, beside `displaysSettled` and
`comparativeDisplayPhase` — **a plain function, which is what §4 says shared
policy at this level is.** Nothing moved onto a mixin, no member gained a second
declaration site, and each display still declares and publishes its own three.

### The stated payoff is inverted

"Three rows instead of two rows and a footnote" changes the code to simplify a
document. The document should describe the structure. The footnote stays and now
carries the reason.

## Consequences

- The display-stacks section of ARCHITECTURE.md keeps its third-shape paragraph,
  now stating *why* rather than only *what*, and linking here.
- **The comparative displays have no cancel and no retry. That is a feature gap,
  not an architecture gap.** Closing it does not need `FetchMixin`: it is a
  `fetchCanceled` volatile plus `reload` on `SyntenyFetchStateMixin`, a
  `void self.reloadCounter` read in each `prepare`, and the `canceled` /
  `onCancel` / `onRetry` props `LoadingOverlay` already accepts. Composing
  `FetchMixin` would not, by itself, produce a button.
- `SyntenyFetchStateMixin` stays the *state* mixin — volatiles plus the
  overridable `fetchInert` hook that a cross-display consumer
  (`displaysSettled`) needs a declared name for. Growing it is fine; growing it
  by composing `FetchMixin` is what this rejects.
- Revisit if `FetchMixin`'s single-fetch observable core is ever split from its
  per-region aggregation, or if MST's inference depth stops being the binding
  constraint (ADR-041's own revisit condition).

## Since (2026-08): the feature gap closed, the decision unchanged

Recorded here rather than edited into the text above, which is the decision as
it was made. **The cancel and the retry both shipped, without `FetchMixin`**,
and the Consequences bullet predicting what that would take was right about the
parts it named: `SyntenyFetchStateMixin` grew `reloadCounter` + `reload()`, then
`fetchCanceled` + `cancelFetchByUser()`, and `ComparativeFetchStatus`'s Material
binding forwards the three `LoadingOverlay` props — one render site, since it
is the only place either view draws a loading state. The two trigger reads live
in `installComparativeFetchAutorun`'s body rather than in either display's
`prepare`, which is one skeleton instead of two copies.

What the bullet did not foresee is that **the cancel needs the stop, not just
the flag.** The rotation lives in the skeleton's closure, so it hands `cancel`
to the mixin at install (`setStopActiveFetch`); with the flag alone nothing
rotates the token, the cancelled RPC stays `isCurrent()`, and it commits its
plot over the load the user just stopped. §2's aside that "composing the mixin
adds the state, not the feature" holds in both directions, then.

Two sentences of §2 read as history now: both overlays have a cancel
affordance, and `DisplayStatusOverlays.tsx` stopped rendering a bare
`LoadingProgress` when `ComparativeFetchStatus` landed. Nothing in the decision
turns on either.
