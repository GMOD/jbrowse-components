---
name: handoff-split-read-junction-arcs
description:
  Live state of the split-read junction arc thread — a new sashimi-band feature
  and an unrelated arc-band bug fix sharing one branch, with two consumers of
  the changed feed known broken and the question that started the thread still
  unanswered.
---

# Handoff: split-read junction arcs, and the arc band's cross-region bug

**Nothing here has landed.** It is all on one branch that should probably be at
least two.

- **Worktree**: `.claude/worktrees/split-read-sashimi-arcs`
- **Branch**: `worktree-split-read-sashimi-arcs`, 7 commits ahead of `main`,
  rebased onto `main` at `b6f378d186`, clean tree
- **Green**: 172 suites / 1821 tests in `plugins/alignments`, typecheck, lint

## How the thread got here

It started as a figure request: on `cancer_sv/k562_bcr_abl_split`, could the
split reads get "a special sashimi arc" — one counted arc for the BCR-ABL1
fusion instead of the fan of per-molecule bezier connectors. That got built and
it works.

The reviewer then asked whether it was just a duplicate implementation of the
read-connection arcs, which already coalesce and already spend support on stroke
width. Investigating that turned up a real bug in the arc band, the thread
turned into fixing it, and **the duplication question was never answered.** It
is still exactly as open as when it was asked.

## What is on the branch, in two pieces

### Piece A — the sashimi-band feature (commits 1-3)

`cfeeb76274` `0775fa61b4` `2053dc0e6b`

One counted arc per split-read junction, drawn over the coverage band with
thickness and a count label from the supporting molecules, able to join two
chromosomes. One new config slot, `showSplitJunctionArcs`, in the sashimi
submenu; the score floor and the label toggle are shared with the splice arcs
rather than duplicated.

- `features/sashimi/arcGeometry.ts` — geometry extracted from `computeOverlay.ts`
  so both producers share it. `SashimiArc` gains `endRefName` and `title`.
- `features/sashimi/splitJunctions.ts` — enumerate via `iterLinkedPairs`,
  canonically order the ends, cluster within 10bp taking the modal site, count.

**Verified by eye.** The k562 figure was regenerated and read: one arc from
chr22:23,290,4xx to chr9:130,854,0xx across the region seam, labelled 28, and
the ABL1 splice junction immediately downstream reads 27 — the same molecules
continuing, which is the internal check that the count is right. At
`minSashimiScore: 1` no further split arcs appear, so it really is one junction.

The figure spec and the tutorial prose were updated to match.

### Piece B — the arc band's cross-region bug (commits 4-6, plus doc regen)

`20927c427c` `0e2198fc72` `3e41d7da34` `b9037d9c30`

Unrelated to piece A except that investigating piece A found it.

An arc whose two feet are in different displayed regions was handed to **both**
regions' buffers, on the reasoning — written into a test — that each block
paints the foot it holds and the leg leaving toward the other. They never join.
Each block maps bp to x through its own range (`bpToClipX` off
`u.bpHi/bpLo/bpLen` on the GPU, `bpToScreenX(bp, block, …)` on Canvas2D) and the
GPU draws into a viewport that IS the block, so the far foot is extrapolated at
that block's scale to a place the other block is not, and the scissor cuts what
is left. The reader gets two half-curves pointing at nothing.

Measured, on the HG02768 inverted duplication with its window split into two
regions 300 bp apart: **52 of 381 arcs (13.6%) were cross-region**, i.e. 104
dangling halves. Two regions 2 Mb apart: 0. One region: 0. The k562
two-chromosome view: 0 arcs and 8 ticks (see below). A fragment can straddle only
one seam, so the set is inherently small and an SVG overlay can afford it.

The fix: `resolveArcsForRender` partitions the resolved arcs, the per-region
buffers stop carrying what they cannot draw, and `CrossRegionArcsOverlay` draws
the rest across the whole view with each foot resolved through its own displayed
region. `arcMark` was split into `arcMarkFrom` (two already-projected feet) and
`arcScreenPath` into `arcMarkScreenPath` (a resolved mark), so the overlay traces
the renderers' own geometry rather than a lookalike.

**Verified by eye**, same probe before and after: the coloured arcs go from two
dangling halves to single curves across the divider, and the grey within-region
concordant domes are unchanged.

## Known broken, and not fixed

**This is the part to read.** Taking cross-region arcs out of `arcsByGroup` means
that getter no longer answers "what arcs does this lane have", and consumers that
used it that way are now wrong. Three of the six were; one was found and fixed
reactively, then the rest were enumerated:

| consumer                       | state                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hasArcs` (band reservation)   | **fixed** (`3e41d7da34`) — a lane whose every arc crossed a seam reserved no strip, so the arcs went from wrong to absent                                                                                                   |
| `arcLegendCategories`          | **BROKEN** — walks `arcsByGroup` alone, so a colour present only on cross-region arcs loses its legend swatch. The failure this repo already names: a connector on screen with no key entry                                 |
| `arcsYDomainBp`                | **BROKEN** — `max(maxFlatArcSpanBp)` over the same map, so in READ-CLOUD mode the shared Y axis is sized too small and `insertSizeTickSections` labels its top tick with a number that is not the largest insert on screen |
| `sourceSections`               | correct — it is the per-region upload feed                                                                                                                                                                                 |
| `resolveArcHover`              | correct — cross-region arcs get native SVG hover instead                                                                                                                                                                   |
| `ArcDebugOverlay`              | correct-ish — it traces what the renderer draws, so it now shows nothing for these. Worth a comment, not a fix                                                                                                              |

**The shape is what produced them, not three separate slips.** Removing arcs from
the lane's list makes forgetting the default. The safer shape is to keep one list
per group with a `crossRegion` flag on each arc, so "this lane's arcs" stays true
and only the two DRAWING consumers filter. A new consumer then gets the right
answer without having to know the distinction exists.

## Not verified at all

- **The SVG export path**, for either piece. `CrossRegionArcsSvg` and
  `SashimiArcsSvg` share their geometry with the live overlays and are
  typechecked, but no SVG export has been rendered and looked at.
- **Dark mode**, for either piece.
- The hovered-arc highlight (`ArcHoverOverlay`, driven by `hoveredArcHighlight`
  off the canvas hit test) does not apply to cross-region arcs — they thicken
  their own stroke instead, like sashimi. Consistent within itself, mildly
  inconsistent with the arcs beside them.

## The question that started it, still open

Is the piece-A sashimi arc a duplicate of the read-connection arcs?

For a **same-chromosome junction inside one region**: substantially yes. The arc
band already builds the junction (`splitJunctionArc`), coalesces identical ones
into a `ComputedArc` with `support`, and spends that on stroke width via
`arcLineWidth`, with the same split-deletion/split-inversion colour semantics.
The two can also visibly contradict each other — the arc band coalesces on exact
coordinates (`arcKey`), piece A clusters in a 10bp window, so at a junction with
microhomology jitter one says 12 and the other 28 at the same locus.

For an **interchromosomal junction**: no, and this is the case k562 is. `resolveArcs`
(`compute.ts:1189`) short-circuits on `p1Ref !== p2Ref` and drops a vertical tick
at each endpoint instead of ever building an arc — 8 ticks in the k562 view where
4 arcs belong. **Piece B does not touch this.** The overlay would draw such an arc
happily; no arc ever reaches it.

The documented rationale for the tick rule — insert size, long-range distance and
pair orientation are all meaningless across refs — is about MATE LINKS. A split
read physically crosses the junction, so the refusal is arguably too broad for
that arm. Changing it is a product decision that revises a decision the code
argues for at length, and it was left alone deliberately.

## Next steps, in the order they should happen

1. **Rework the partition into a flag rather than a removal.** Keep every arc in
   the per-group list with `crossRegion: boolean`; let the per-region packer and
   the overlay each filter. This fixes `arcLegendCategories` and `arcsYDomainBp`
   by construction and closes the class rather than the two instances.
2. **Split the branch.** Piece B is a bug fix that stands on its own and should
   land on its own. Piece A is a feature whose justification depends on step 3.
3. **Decide the interchromosomal question.** If a both-ends-displayed
   interchromosomal connection should draw as an arc, that is a small change to
   `resolveArcs` (it needs its own height rule, since a cross-chromosome arc has
   no genomic span — `arcHeightFraction` in piece A draws that case at the band
   ceiling, which is the honest answer). It would subsume piece A, and piece A
   should then probably be dropped rather than kept alongside.
4. **Whatever survives, render an SVG export and a dark-mode frame and look at
   them.**

## Loose ends

- **The k562 figure PNG is regenerated but NOT pushed.** The spec and prose
  changes are committed, so until someone runs
  `pnpm figures:push --exact --filter cancer_sv/k562_bcr_abl_split` and commits
  `figures.lock`, the site shows the old figure against the new caption. The
  worktree's `website/static/img` is the usual symlink into the primary
  checkout, which was left holding the OLD figure — nothing there was clobbered.
- **`pnpm autogen` fails on `main`, independently of this thread.**
  `12e804ccbe` left `createTestAlignmentsDisplay` in a form the DisplayChrome
  adoption-map generator cannot parse: "cannot resolve ReactComponent
  (ArrowFunction). Teach this generator the idiom rather than letting the row
  disappear." Six other generated docs were also stale on `main`; the two
  alignments model tables are regenerated here (`b9037d9c30`), the rest were
  left alone.
- `createTestAlignmentsDisplay` gained a `palette` on its session
  (`3e41d7da34`). Without it the harness booted a display that threw on any
  getter resolving a colour, which reads as a fault in the getter rather than a
  hole in the fixture.

## Process note

The measurements above are good and the fix is verified. The way it got written
was not: roughly 600 lines across five commits went in without the approach
being put in front of the reviewer once, and the consumer sweep that found the
two broken getters was done only after being challenged — reactively, after one
of the three had already bitten. The next step is a shape change, and it is
worth agreeing the shape before writing it.
