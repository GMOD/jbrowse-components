# @jbrowse/display-kit

The display integration layer: the fetch foundations, the byte gate, the display
chrome, SVG export, and the `RegionHost` contract. No barrel; the `exports` map
is the API, pinned by `src/publicApi.test.ts`. The tests that need a real linear
genome view (`perRegionTestEnv.ts` and its six suites) live in
`plugins/linear-genome-view/src/displayKitTests/`, since this package sits below
that plugin.

`FetchMixin` (abort rotation, staleness, `isLoading`) +
`MultiRegionDisplayMixin` (autoruns, `fetchRegions`, `loadedRegions`,
overridable hooks). Status chrome is `DisplayChrome.tsx` —
`agent-docs/reference/DISPLAYCHROME.md`, adr-026.

**Two LGV foundations, not three.** `GlobalFetchMixin` is the whole global
family, and `installGlobalFetchAutorun` lives in its own file beside it;
ARCHITECTURE.md's "Display stacks" has the ladder. `KeyedFetchMixin` is a layer
under it, not a foundation: `FetchMixin` plus the `currentFetchKey` /
`loadedFetchKey` compare, split out so the comparative foundation
(`ComparativeFetchMixin`, `@jbrowse/synteny-core`) composes the same pair
instead of restating it (ADR-105).

**The fetch sequence itself is in core**, not here: `runFetchOnce` /
`installFetch` (`@jbrowse/core/util/installFetch`) own begin → clear the error →
run → commit-if-current → `handleFetchError` → end, plus the autorun over it —
the leading edge, the unconditional `reloadCounter` read, the durable cancel
gate, the freshness gate with its reload epoch, and both contract checks.
`installGlobalFetchAutorun` is a declaration over that skeleton (its gates, its
signature as the freshness key, `FetchMixin`'s rotation lent through the
`rotation` option so `cancelFetch` reaches the fetch it installs), the same way
the comparative installer is. There is no on-demand entry beside it: the
single-shot one there used to be, for tests wanting one round trip, carried a
copy of the family's gates that drifted from the installed ones on three of four
terms, and a test that wants a fetch drives the installed autorun through the
view and waits for its RPC (`plugins/variants/src/LDDisplay/testEnv.ts`'s
`awaitFetch`). Gate behaviour is `installGlobalFetchAutorun.test.ts`'s. The
declaration takes `FetchMixin`'s begin/end/error trio from
`fetchMixinLifecycle`, which `runFetch` uses too. `FetchMixin.runFetch` is the
MST-flow wrapper the per-region family holds `runFetchOnce` through — it needs
the flow (so a fetch autorun's synchronous prefix runs untracked) because its
trigger is `planRegionFetch`'s autorun, not the skeleton's.

The composition and fetch rules a display must not break are in
`agent-docs/ARCHITECTURE.md` ("What not to do"): mixin order, `afterAttach`
super-chaining, `rpcProps`/`regionHasData` in `.actions()`, the `rpcProps()`
loop trap, picking the payload out of a snapshot, unconditional trigger reads.
What follows is local.

## Rules

Each is a section of
[reference/DISPLAY_KIT.md](../../agent-docs/reference/DISPLAY_KIT.md), which has
the why — read that section before changing what it covers.

- Attach
- Contract checks
- Read a scalar off the host, never rebuild its arrays per frame
- A hit test's index needs an observer, or it is not memoized
- Height and scroll are hooks
- Four readiness axes — don't collapse them
- `dataSuperseded` covers what `fetchInputs` cannot state
- Fetching
