---
name: the-global-fetches-hand-roll-prepare-run-commit
description: The comparative installer already splits a fetch into prepare/run/commit so "capture before the await" and "commit only if current" are structural. The global family gets shouldFetch/fetch instead, so HiC, LD and arc each write both rules out by hand — one of them as the same seven-line comment twice — and whether a bail-out read is tracked depends on whether the display happened to declare its fetch as an MST action.
---

# The global fetches hand-roll prepare/run/commit

**Status: built.** `installGlobalFetchAutorun` takes `GlobalFetchPhases` now, and
`performHicFetch` / `performLDFetch` are gone. Three of the sections below were
wrong about the code and are corrected in place — read those corrections before
trusting the prose around them.

`installComparativeFetchAutorun` (`packages/synteny-core/src/installComparativeFetchAutorun.ts`,
175 lines) takes three callbacks and its docstring says why each exists:

- `prepare` runs synchronously inside the autorun, so its reads — and only its
  reads — are the dependency set. Returning `undefined` skips the run.
- `run` owns every await and writes nothing to the model.
- `commit` is synchronous and runs only while this is still the latest fetch.

`installGlobalFetchAutorun`
(`plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalDataDisplayMixin.ts:153`)
takes `shouldFetch` and `fetch`. So the three global displays write the same two
disciplines out themselves:

| display | bail-out terms | captured before the await | staleness guard |
| --- | --- | --- | --- |
| `performHicFetch` (`plugins/hic/src/LinearHicDisplay/model.ts:614`) | 4 | `offsetPx`, `bpPerPx`, `viewBlocks` | `ctx.isStale()` at :656 |
| `performLDFetch` (`plugins/variants/src/LDDisplay/shared.ts:729`) | 4 | `offsetPx`, `bpPerPx` | `ctx.isStale()` at :777 |
| `fetchArcFeatures` (`plugins/arc/src/shared/fetchArcFeatures.ts:18`) | 3 | the region set | `ctx.isStale()` at :47 |

## The capture is the half that is written twice as a comment

`plugins/hic/src/LinearHicDisplay/model.ts:630` and
`plugins/variants/src/LDDisplay/shared.ts:749` carry the same seven lines,
differing in one word — HiC says "below", LD says "above":

> Capture the viewport this fetch is issued for. `setLastDrawnViewport` below
> must record *these* values, not a live re-read: `ctx.isStale()` only trips on a
> newer fetch or a cancel, so a pan/zoom during the RPC would otherwise stamp the
> new viewport onto a matrix packed for the old one — `renderTransform` would then
> read scale 1 and leave the stale pixels un-rescaled, and the freshness getter
> below (and so `svgReady`) would call them current.

**Inside those same two function bodies, the other capture already is
structural.** `byteGateBlocksFetch` reads `gateViewport` above its own await, and
`RegionTooLargeMixin.gateFetchState()` (`plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts:668`)
is a method rather than a getter precisely so that calling it *is* the snapshot —
[REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md#measurement-follows-the-viewport)
says to spell it there and nowhere else, tests included. One function body, two
values that must be captured before the round trip, one of them enforced by a
signature and one by a paragraph.

The drawn viewport is worked separately in
[the-drawn-viewport-capture-is-a-comment](the-drawn-viewport-capture-is-a-comment.md),
because that half is a two-call-site change on
`StaleViewportRescaleMixin` and lands without touching any skeleton.

## Whether the prefix is tracked depends on a declaration nobody chose for this

`performHicFetch` and `performLDFetch` are MST actions, so MobX runs their
bail-out reads inside `untracked` and the installer's trigger list is the whole
dependency set. `fetchArcFeatures` is a plain `async function` called from the
autorun body, so the reads before its first `await` — `isMinimized`,
`view.initialized`, `view.staticBlocks.contentBlocks` — are tracked, and arc's
autorun watches `staticBlocks` on top of the `dynamicBlocks` the installer reads.

Nothing moves today: static blocks are quantized from the same `offsetPx` /
`bpPerPx` the dynamic ones are, so the extra dependency fires on a subset of the
runs the installer already causes.

**The example was right and its mechanism was wrong.** `staticBlocks` was
already in arc's dependency set before any of this, through the gate rather than
through the declaration shape: `shouldFetch` was `() => !self.dataCurrent`, and
`dataCurrent` → `currentRegionSignature` → `view.staticBlocks.contentBlocks`. So
the tracked-prefix difference between a plain `async function` and an MST action
is real, but arc is not evidence of it — pick a display whose prefix reads
something its gate does not before citing this again. Naming a correlation as a
mechanism is the failure this paragraph committed, not the one it was warning
about.

## The prefix's stated reason has one caller left, and it is a test

A comment in `installGlobalFetchAutorun`'s body justifies the duplicated
bail-outs as "each `fetch` re-checks isMinimized / view.initialized / an empty
viewport for its direct callers, so repeating them would be duplication, not
safety", and ARCHITECTURE.md §"The global-fetch trigger list must be read
unconditionally" repeats it.

Grep the three names. Every production caller is that display's own `fetch:`
thunk; the only direct caller anywhere else is
`plugins/variants/src/LDDisplay/derivedRegionTooLarge.test.ts`, which drives
`performLDFetch` twice. No test calls `performHicFetch` or `fetchArcFeatures`
directly at all.

**"Duplication" overstates it, and the build found where.** Only the *gate* half
was written twice — HiC's `effectiveResolution`, LD's `showLDTriangle`, each
also spelled in `shouldFetch`. `isMinimized` and the empty-viewport check were
written **once**: the skeleton reads `isMinimized` to track it and never skips on
it. So those two moved into `prepare` rather than being deleted, and a collapse
that treated the whole prefix as redundant would have dropped two live gates.

## The shape

`installGlobalFetchAutorun` grows `prepare` / `run` / `commit` with the
comparative installer's contract, and `shouldFetch` becomes `prepare` returning
`undefined`. The captured viewport is `prepare`'s return value, so `commit`
takes it as an argument and there is nothing for a comment to ask anyone to
remember.

What must NOT change in the process:

- **The per-family debounce stays per-family.** 600 ms per-region, 500 ms LD,
  1000 ms HiC and arc, `RPC_DEBOUNCE_MS` comparative. These are tuned against
  different RPC costs, and the leading-edge priming already lives in the one
  shared `leadingEdgeDebounce`.
- **Do not reach for `FetchMixin`.**
  [ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md)
  rejected folding the comparative displays onto that mixin on four independent
  grounds. This proposal runs the other way — it moves a plain function DOWN to
  the family that lacks it — which is the shape that ADR's §4 prescribes.
- **The too-large skip stays in the skeleton.** All three composers had it in
  their own gate once, and restating it froze the estimate at the viewport it
  was captured over
  ([REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md#measurement-follows-the-viewport)).

## Oracle: both installers' suites already exist

`installGlobalFetchAutorun.test.ts` is 19 tests and
`installComparativeFetchAutorun.test.ts` is 8. The per-region family's
`installPerRegionFetchAutoruns.test.ts` (19) is the third, and it is the one to
run untouched, since this changes nothing about that family.

**"Run both unchanged" was the wrong ask for the first of them, and cannot be
met.** `installGlobalFetchAutorun.test.ts` *constructs* the installer, so
changing its parameters necessarily edits that file's `setup()` and its
hand-built fixture. What survives unchanged is every one of its 19 assertions,
which is the property that was worth asking for; the harness around them is not.
Say "the assertions survive" when writing the next oracle line like this one.

The dev-only contract checks come along for free: `assertDisplayContract` and
`makeRetryContractCheck` are already called by whichever installer put the
display's autoruns in, which is the rule
`plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md` states for a family
growing its own skeleton.

## Where this sits

Independent of the three render-path simplifications
([one-upload-model-not-four](one-upload-model-not-four.md),
[absolute-coordinates-for-hic-and-ld](absolute-coordinates-for-hic-and-ld.md),
[one-mark-declaration-per-feature](one-mark-declaration-per-feature.md)) — this
one is the fetch side, and it touches none of the files they do.

One interaction is worth knowing before scoping either.
`absolute-coordinates-for-hic-and-ld` deletes HiC's and LD's viewport capture
outright, since a display whose worker output is absolute has nothing to stamp —
so the *example* used above goes away with it. The skeleton does not: a fetch
still has to capture its gate viewport and its cache key
([a-region-fetch-key-not-a-cache-predicate](a-region-fetch-key-not-a-cache-predicate.md)),
and both of those survive that rewrite untouched.

## Already declined nearby — do not re-derive

- **`SignatureFetchMixin` on `FetchMixin`** —
  [ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md).
  Its consequences list also records what the comparative displays still owe
  (cancel and retry), which is a feature gap and not this.
- **A shared assembly-swap autorun installer for the same pair** —
  [ADR-042](../architecture-decision-records/adr-042-no-shared-assembly-swap-autorun-installer.md).
- **A measurement-only RPC path for a gated display** — declined in
  [REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md#measurement-follows-the-viewport);
  the fetch is the measurement.
