---
status: Accepted
summary: "The comparative displays compose `FetchMixin` through `KeyedFetchMixin`, the keyed half of the global family split out so both keyed families run one freshness pair, one rotation, one cancel and one retry; `SyntenyFetchStateMixin` is gone, and the one difference that survives — a cancel durable until Retry — is a declared absence in the installer, not a second foundation"
---

# ADR-105: The comparative displays compose `FetchMixin`

## Status

Accepted (2026-09). Supersedes
[ADR-054](adr-054-comparative-displays-keep-their-own-fetch.md), which rejected
exactly this — a `SignatureFetchMixin` on `FetchMixin` for `LinearSyntenyDisplay`
and `DotplotDisplay` — on four grounds. Each ground rested on an observation
that has since stopped being true, and this record takes them in ADR-054's own
order. ADR-041 (no mixin composed into `BaseDisplay`) and ADR-042 (no shared
assembly-swap installer) stand.

## Context

By 2026-09 `SyntenyFetchStateMixin` was a second spelling of every `FetchMixin`
member the loading overlay reads. Side by side:

| `FetchMixin` | `SyntenyFetchStateMixin` |
| --- | --- |
| `isLoading` (`activeStopToken !== undefined`), set by `beginFetch` / `endFetch(current)` | `fetching`, set by `setFetching(true)` / `setFetching(false)` under the same currency guard |
| `reloadCounter`, `reload()` | `reloadCounter`, `reload()` |
| `fetchCanceled`, `cancelFetchByUser()` — stops `fetchRotation`, a member | `fetchCanceled`, `cancelFetchByUser()` — stops a closure handed back from the installer at attach (`setStopActiveFetch`) |
| `fetchInert` hook | `fetchInert` hook, same name by ADR-082 |
| `adapterConfigKey` | folded into the key by `comparativeFetchKey` at the installer |
| `GlobalFetchMixin.loadedFetchKey`, `commitFetchResult`, `dataCurrent`, `reload` dropping the stamp | `loadedFetchKey`, `setLoadedFetchKey`, `comparativeFetchFlags.dataCurrent`, `reload` dropping the stamp |

`installComparativeFetchAutorun` had already become a declaration over
`installFetch` — the same skeleton `installGlobalFetchAutorun` declares over —
differing from it in the rename context a `run` is handed, the absence of the
byte gate, and one wiring hack: the rotation lived in the installer's closure
because the mixin had none, so the installer handed `cancel` back to the model
(`setStopActiveFetch`) for the Cancel button to reach. The generated freshness
census in SVG_EXPORT.md listed the same compare under three spellings.

## Decision

**Compose it.** Three moves, all in one change:

- **`KeyedFetchMixin`** (`@jbrowse/display-kit`) is `FetchMixin` plus the one
  compare a single-payload fetch runs: the `viewSignature` hook, `currentFetchKey`
  over it plus the settings and adapter axes, the `loadedFetchKey` stamp that only
  `commitFetchResult` writes, `dataSuperseded`, `dataCurrent`, and the `reload`
  chain that drops the stamp. It was `GlobalFetchMixin`'s middle; `GlobalFetchMixin`
  composes it and keeps only what an LGV display can say (`host`,
  `staticBlockSignature`, `viewportEmpty`, `canRender`, `paintInert`, `svgReady`,
  `displayPhase`).
- **`ComparativeFetchMixin`** (`@jbrowse/synteny-core`) composes `KeyedFetchMixin`
  and adds what a shared canvas wants: the `fetchLanded` / `hasDrawable` hooks, `loading`
  (first load — full overlay) versus `refetching` (stale plot still on screen —
  corner chip), `svgReady` over `computeSvgReady`, and `assembliesSwapped`. Both
  displays rename their `currentFetchKey` getter to `viewSignature` and tag
  themselves `#displayFoundation ComparativeFetchMixin`, so the display-stacks
  table has three rows.
- **`installComparativeFetchAutorun`** lends `self.fetchRotation`, takes
  `fetchMixinLifecycle`'s begin/end/error trio, gates on `currentFetchKey`
  against `loadedFetchKey`, and commits through `commitFetchResult` — the same
  pieces the global installer uses — and adds only the refName rename. The
  `setStopActiveFetch` hand-back is gone with the reason for it; `installFetch` no
  longer returns the rotation's `cancel`, since nothing reads it.

`SyntenyFetchStateMixin`, `comparativeFetchFlags`, `comparativeFetchKey`,
`setFetching`, `setLoadedFetchKey` and `stopActiveFetch` are deleted.
`comparativeReadiness`'s `displaysSettled` and `comparativeDisplayPhase` read
`isLoadingOrCanceled` and `dataCurrent` off the display — the fields
`computeLoadingTerm` reads on an LGV display — in place of `loading || refetching`.

Layering: `@jbrowse/synteny-core` now depends on `@jbrowse/display-kit`. Both are
`packages/*`, display-kit imports nothing from synteny-core, and the workspace
layering test pins only upward edges, so this is a lateral dependency and not a
recorded exception.

### ADR-054's four grounds, and how each lapsed

**§1 — "the fold does not retire the second stop-token machine."** True, and it
still is: `createStopTokenRotation` stays the primitive, `FetchMixin` the wrapper
for a display's primary fetch, and `getMultiSampleVariantSourcesAutorun` still
holds a second rotation beside a composed `FetchMixin`. ADR-054's own 2026-08-20
note observed that `FetchMixin` had become a wrapper over that primitive. What the
fold retires is not a machine but a *hand-back*: with the rotation a member of the
model, `cancelFetchByUser` stops it directly, and the installer no longer has to
return its closure's `cancel` for the model to store. The section's argument was
about machines and was never wrong; it was a caution, not a reason.

**§2 — "`FetchMixin`'s net-new surface is mostly inapplicable or unreachable."**
Every item lapsed on its own. The per-region status fan-out left `FetchMixin` for
the fetch context. `fetchCanceled` / `cancelFetchByUser` "need a cancel
affordance to mean anything" — both overlays got one (`ComparativeFetchStatus`),
and `SyntenyFetchStateMixin` grew the pair. `reload()` "lives on
`GlobalFetchMixin`, not `FetchMixin`" — it moved to `FetchMixin` when
`reloadCounter` did, and `SyntenyFetchStateMixin` grew that pair too. What ADR-054
called "a rename of machinery `installComparativeFetchAutorun` already implements
correctly" had become the whole list, implemented twice.

**§3 — "the mixin cannot see `error`, and the obvious fix is what ADR-041
forbids."** The obstacle was real and the conclusion drawn from it inverted.
`SyntenyFetchStateMixin` could not read `error` because declaring one would be a
third declaration site beside `BaseDisplay`'s and `FetchMixin`'s. Composing
`FetchMixin` — the second site, the one every LGV display already composes after
`BaseDisplay`, whose coherent set wins — is precisely what lets the four flags be
getters on the comparative mixin. ADR-041 forbids a *new* declaration site; this
uses the existing one. The inference-depth half of that section is answered by
the typecheck and `build:esm` passing with `KeyedFetchMixin` composed under
`GlobalFetchMixin` and `ComparativeFetchMixin`; it is under neither
`MultiRegionDisplayMixin` nor any display chain that was near the budget.

**§4 — "the shared policy is already shared as plain functions."** It was, and the
functions restated policy the mixins already derive: `comparativeFetchFlags`
recomputed `dataCurrent` from the same two strings `GlobalFetchMixin.dataCurrent`
compares, `svgReady` over the same `computeSvgReady` `foundationSvgReady` runs,
and `refetching` from a `fetching` flag standing in for `isLoading`. A plain
function is the right shape for policy a mixin *cannot* hold (ADR-041's
argument); these were held by a mixin already and copied out because the
comparative displays did not compose it. `comparativeReadiness` stays a set of
plain functions, because the shared canvas genuinely lives on another model
(ADR-076).

### What survives as a declared difference

**A comparative cancel is durable until Retry.** Both LGV installers lapse a
user cancel on a viewport change (`ClearBlockingStateOnViewportChange`,
`ClearCancelOnViewportChange`); the comparative installer installs neither, and
its header says why: the viewport *is* the fetch input there, so the same clear
would un-cancel on every trigger, and these displays sit on single RPCs that can
run for minutes against a remote index. The gate is `FetchMixin`'s, the reopen is
`reload()`, and the absence is the installer's — not a second foundation's.
`installComparativeFetchAutorun.test.ts` ("is durable: an input change does not
restart the load") pins it.

**The two-way loading answer.** `loading` and `refetching` stay this family's
own: a shared canvas draws a corner chip over a stale plot where an LGV display
scrims. They are getters on `ComparativeFetchMixin` now, over `isLoading` and the
`fetchLanded` hook (`ready` until this change — renamed because the generated
hook table attributes by directory, and `ready` is a name three unrelated
models declare), rather than a function each display called with nine
arguments.

**`displayPhase` stays per display.** It reads the shared canvas's
`surfaceReadiness`, which the synteny level and the dotplot view publish from
different places, so each display makes one call to `comparativeDisplayPhase`
with itself and its surface.

## Consequences

- One freshness compare for every single-payload fetch, spelled once. The
  generated census in SVG_EXPORT.md lists `KeyedFetchMixin` where it listed
  `GlobalFetchMixin` and `comparativeFetchFlags`.
- `reloadCounter`, `fetchCanceled`, `fetchInert`, `cancelFetchByUser` and
  `reload` are one declaration for all three fetch foundations; chord and the
  breakpoint overlay still declare their own, composing none of them.
- The comparative displays gain what `FetchMixin` carries and they did not
  reach for: `fetchGeneration`, `cancelFetch`, `awaitingPrerequisite`,
  `awaitingDependentData`, `rpcPropsCacheKey`, `openStatusStream`, and a
  `beforeDestroy` that stops the fetch and resets the status window (the
  installer's own disposer did the first half before). A comparative display
  that grows a `rpcProps()` gets the settings axis in its key for free, which is
  the global family's answer to a settings change.
- The comparative test harness composes the real `ComparativeFetchMixin` and
  reads `isLoading`; a browser probe that read `fetching` reads `isLoading`.
- `foundationParity.test.ts` reads `dataSuperseded`'s global-side body off
  `KeyedFetchMixin`; the hook-overrides table gains `fetchLanded` and `hasDrawable`
  and loses `SyntenyFetchStateMixin` as a second owner of `fetchInert`.
- Revisit if a comparative display ever needs the byte gate or the render
  lifecycle on the display itself — that is `GlobalFetchMixin`, and the shared
  canvas (ADR-076) is what says it will not.
