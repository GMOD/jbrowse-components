---
status: Accepted
summary: 'The LGV viewport persists as a bp window, not as offsetPx/bpPerPx'
---

# ADR-070: The viewport is a stored window, not stored pixels

## Status

Accepted

## Context

`LinearGenomeView` persisted its viewport as `offsetPx` and `bpPerPx`. Both are
functions of the measured width, and the width was never written down, so the
persisted state was incomplete: it named a scale and a scroll position without
naming what they were a scale and a position _in_.

Two consequences followed, and only the first was ever discussed.

**A resize kept the scale and changed the window.** Narrowing the browser let
the right edge eat into the sequence on screen. That was deliberate, and it was
a block-cache optimization: `calculateStaticBlocks` sizes blocks as
`ceil(800 * bpPerPx)` and keys them `assembly:refName:start:end:index`, so
holding `bpPerPx` across a resize kept every block key — and therefore every
fetched region — identical. A resize repriced nothing.

**A session snapshot restored a different window than it was authored with.**
The same policy applied to the first measure, where it is not a policy at all
but a loss. Measured on volvox:

| how the view was shared          | window at 500px       |
| -------------------------------- | --------------------- |
| authored at 1000px               | `ctgA:10,001-20,001`  |
| the same view as `&session=`     | `ctgA:10,001-15,001`  |
| the same locus as `&loc=`        | `ctgA:10,001-20,001`  |

The two ways to share a view disagreed, and the snapshot one silently dropped
half the region. `&loc=` was right because `init` resolves the locus against
whatever width the reader has — it computes the answer once, at launch, that
storing the window gives you always.

## Decision

Persist `windowStartBp` and `windowWidthBp`, in the linearized bp space that
`displayedRegions` concatenates — the same space `offsetPx` indexes. There is no
inter-region pixel padding anywhere in the codebase, so the mapping is exact in
both directions and lossless across a region boundary:

```
bpPerPx  = windowWidthBp / width
offsetPx = windowStartBp / bpPerPx
```

`offsetPx` and `bpPerPx` remain, as derived getters under the same names, so the
~300 reads across 79 files were untouched; only the five writes moved, all of
them already inside actions. A resize then needs no arithmetic at all — the new
width simply divides into the stored window — and "keep the window" stops being
a policy and becomes the absence of one.

The zoom anchor moved to bp with it. `zoomTo` had computed the base under the
cursor by converting to pixels and back once per frame; it now works in the
units the state is already in, and the cursor-drift bound in
`index.test.ts` went from 0.2px to 1e-6px.

## Rejected alternatives

**Keep pixels, add the authoring width.** `(offsetPx, bpPerPx, authoredWidth)`
encodes the same window and needs no getters, no write conversion and no ABI
movement. Rejected because the width is then a field that must be kept in step
with two others — the synchronized-representation smell this removes — and
because a launcher that wants to say "frame this locus" still cannot: it would
have to invent a width for the scale to be relative to. That fiction was already
in the tree twice (`buildReadVsRefSpec`, `buildDerivativeVsRefSpec` both computed
`bpPerPx: refLen / viewWidth` from a `viewWidth` threaded in from the caller),
and both now say `windowWidthBp: refLen` and take no width at all.

**Migrate old snapshots by assuming a nominal width.** Rejected: it silently
reinterprets every link ever shared. `legacyBpPerPx` instead carries the old
scale to the first measure, which adopts it at whatever width arrives — bit for
bit what the old code did — so an old link keeps its old behavior.

**Leave the resize policy alone and fix only the restore.** Rejected because
they are one thing. The restore is the first measure; a first measure that
honors the window and a later measure that does not is two rules for one event.

## Consequences

- A resize is now a zoom, and a zoom is a solved case: `FetchVisibleRegions`'
  300ms debounce coalesces the gesture into one refetch, its in-flight guard
  caps concurrent batches at one, and `rpcDataMap` is overwritten in place
  rather than cleared, so nothing blanks. ADR-008 accepted per-zoom refetch and
  ADR-006 is why it does not flicker; this change adds no new failure mode to
  either, it routes a second gesture through them.
- `bpPerPx` is derived, so it carries a ULP of division residue and is not the
  literal a caller passed to `zoomTo`. Every consumer that compares it —
  `isCacheValid` in wiggle and variants, the coarse-block gate — compares
  against a value read from the same getter and so sees one stable double.
  Only a test comparing against a hand-written literal can see the residue, and
  two did.

  That residue is visible one place further out, and it is worth recognizing
  rather than re-diagnosing: block boundaries are `ceil(800 * bpPerPx)`, so a
  ULP can move one by a base and regroup which features fall in which block.
  Nothing moves on screen — geometry is computed from bp — but anything emitted
  in block order comes out permuted, which is what changed the
  breakpoint-split SVG golden. The check that says it is benign is that the
  multiset of emitted elements is identical (16,652 rects, byte-identical
  total length); only their order differs, and the new one is sorted by x where
  the old was not.
- `bpPerPx` is `0` before the first measure, where it used to be `1`. That is
  `Base1DView`'s existing not-yet-measured sentinel and the guards for it were
  already in place, but it is plugin-facing.
- A link authored here opens at the wrong scale in a JBrowse older than this
  change, which finds no `bpPerPx` and takes the default. Emitting legacy pixels
  alongside the window would need a persisted last-measured width — the field
  this ADR declined — so it was left out.
- `Base1DView` (the dotplot axes, the circular view) still stores pixels. It is
  a separate model that reimplements the same 1D logic rather than sharing it,
  and the two `zoomTo`s have already diverged once — `Base1DView` rounds
  `offsetPx`, the LGV deliberately does not. Two viewport representations is the
  condition that produced that split.

## Revisit if

- A drag-resize measurably outruns the fetch debounce. The fix is at the
  debounce, not by pinning `bpPerPx` again — that reintroduces the restore bug,
  which is the same bug wearing the resize's clothes.
- `legacyBpPerPx` and the `bpPerPx`/`offsetPx` pass-through (`launchKeys.ts`)
  can go. They are one field and one list and they are the whole migration, so
  the work is not the question — the question is whether anything still opens a
  session written before this change, and the answer is a judgement about shared
  links and published `defaultSession`s rather than anything the tree can be
  asked. Both are named in the tests that pin them (`pre-window`), and dropping
  them costs an old link its scale, not its locus.
