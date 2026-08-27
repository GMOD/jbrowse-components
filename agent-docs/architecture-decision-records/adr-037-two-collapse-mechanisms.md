---
status: Accepted
summary: "Two \"collapse\" mechanisms stay distinct — automatic sub-pixel density-collapse vs. explicit `displayMode: 'collapsed'`; don't auto-select the preset for dense data"
---

# ADR-037: Two "collapse" mechanisms — automatic density-collapse vs. explicit `displayMode: 'collapsed'`

## Status

Accepted — the two are deliberately distinct and complementary. Do **not**
auto-promote a track to `displayMode: 'collapsed'` for dense data; the
sub-pixel density-collapse already covers that case, and better.

## Context

The canvas feature layout (`LinearBasicDisplay`, and everything that extends
`LinearCanvasBaseDisplay` — including `LinearVariantDisplay`) has **two**
separate things that put features on a single row. They share the word
"collapse" and are easy to conflate. They are not the same, and they were not
introduced together.

**1. Automatic sub-pixel density-collapse (per pile, zoom-driven).** This is
what makes a dense SNP/variant track render as one faded band when zoomed out —
not any display-mode setting. The chain:

- **Worker** (`collect/glyphEmitters.ts`): every plain **`Box`** glyph is tagged
  `densityFade: true` (`densityFade: layout.glyphType === 'Box'`). Gene/transcript
  glyphs are **not** — only whole-feature boxes (SNPs, simple variants, BED
  features) are eligible. Flows through `pushBoxRect` into each rect
  (`collect/emitPrimitives.ts`).
- **Reservation** (`packPreparedRef`): the packer reserves the box the renderer
  paints, `MIN_RECT_WIDTH_PX` clamp included. It used to reserve the raw bp span,
  which is narrower than the clamp for anything sub-pixel — so two sub-pixel marks
  usually did not collide at all, both took row 0, and one was painted over with
  no cue. Worse, whether a given pair *did* collide turned on whether its raw span
  happened to straddle a pixel boundary, so one mark of five would hop to a second
  row on a truncation accident. Reserving what is painted makes a track's row
  count equal its deepest pile, which is what the two decisions below are then
  able to reason about.
- **Candidacy** (`prepareRefPack`): a feature can be collapsed when
  `isSubPixelFade(ext, bpPerPx)` (i.e. `densityFade && renderedWidthPx <
  MIN_RECT_WIDTH_PX`) **and** it has no rendered label **and** it doesn't overlap
  a visible ("solid") feature (`!intersectsMerged(…, solidSpansPx)`). A labeled
  sub-pixel feature (e.g. a miRNA gene at whole-arm zoom) still stacks so its name
  doesn't overprint, and a mark abutting a wide gene box stacks rather than
  drawing on top of it.
- **The depth gate** (`deeplyPiledIds`): candidacy is not enough. A candidate
  shares row 0 only where it covers a point `DENSITY_COLLAPSE_DEPTH` (25) marks
  deep. Since rows are pile depth, that bar is a track height — ~500px in normal
  mode, past any default height and half the autogrow ceiling.

  Per mark, and NOT per connected run of overlapping boxes. The run form was
  written first, on the argument that a collapsed mark calls no `addRect` so row 0
  stays free for the stacker to hand to an overlapping neighbour, which then
  paints into the pile. It was reverted: a run chains through every mark landing
  inside a neighbour's clamped box, so at 1.5px spacing a single 25-deep hotspot
  reached the whole view and put 600 SNVs — a density the gate admits — onto one
  row, overlapping pairwise and too shallow to fade. That is the defect the
  reservation above exists to stop, re-created by its own guard. `collapsedSpansPx`
  books the pile out of row 0 instead, which is both narrower and exact.
- **Fade** (`pileupFadeIds` → `rectDensityFade` → `rect.slang` `densityAlpha`):
  computed per ROW off the layout the packer committed. A sub-pixel mark drawn
  over by `PILEUP_FADE_DEPTH` (3) marks sharing its row renders semi-transparent,
  so a pile reads as density instead of as one opaque bar. Per row because
  occlusion is per row — two marks the stacker put on different rows are both
  fully visible however close their columns — and reading the committed rows means
  the fade needs no notion of *why* marks share one, so `singleRow` mode and the
  depth gate both feed it without a special case.

It is entirely automatic and driven by **on-screen width (zoom) × feature type ×
local pile depth**. Zoom in and the marks exceed `MIN_RECT_WIDTH_PX`, so they
un-collapse and stack normally; thin the data out and the pile stops reaching
`DENSITY_COLLAPSE_DEPTH`, so they stack without a zoom at all. No config, no user
action.

**Where the bar sits, and why it is not the fade's.** The two thresholds answer
different questions in different units: the fade's 3 is an occlusion count in
painted pixels, the collapse's 25 is a track height in rows. Measured on a 1000
Genomes phase-3 slice of chr1 through the real layout at a 900px pane: 46 SNVs
over 2 kb stack 2 rows, and 932 SNVs over 33 kb — the most
`maxFeatureScreenDensity`'s default of 1 feature/px admits — stack 11. So nothing
the display agrees to draw ever collapses, and every allele in an ordinary variant
track keeps a row, stays visible and stays hoverable. What the bar catches is the
pileup no gate saw: 900 marks inside 1.3 kb pile ~147 deep, and 2900px of
one-mark-per-row conveys less than a single faded band.

Setting it at the fade's 3 was tried and rejected in the same pass: it fires on
ordinary dense variant views, where a 3-tall stack is strictly more informative
than a faded column, and it puts the boundary where panning flips it.

The bar is not a promise that nothing the gate admits collapses — the gate counts
features per pixel and this counts depth, so 25 records called at one bp pass the
gate and pile 25 deep. It is a promise about the picture: what collapses is a
column no stack could have shown.

**A fixed-height density band opts out of rows entirely.** `flattenRows` packs
every feature onto row 0 the way `displayMode: 'collapsed'` does, without that
mode's label suppression. The multi-sample variant lane takes it: the band is 40px
holding a whole callset, its records are meant to share pixels rather than each
claim a row, and stacking them honestly needs 68px — which cost the band every
name through the fit ladder. Its old flatness came from the reservation bug, so
this is the same picture asked for rather than inherited. A `displayMode:
'collapsed'` that keeps its names generally is `ideas/collapsed-mode-labels.md`,
still parked.

**2. Explicit `displayMode: 'collapsed'` (whole-track, user-chosen).** A
feature-height preset alongside `normal`/`compact`/`superCompact`. When selected
it packs **every** feature onto row 0 (`singleRow` bypass in `packPreparedRef`) and
suppresses **all** labels — names via the `showLabels` getter,
descriptions via `effectiveShowDescriptions`, and worker-baked subfeature labels
via the `rpcProps` `subfeatureLabels: 'none'` override. It uses height multiplier
1 (full body height, single row). It is a deliberate "show me everything on one
line" overview, regardless of feature width. See the `displayMode` menu radio.

(Naming hazard: an **old**, removed `displayMode: 'collapse'` — no "d" — existed
briefly. It never single-rowed; it only decimated labels and was never
UI-reachable. It was deleted, and `migrateBasicSnapshot.normalizeDisplayMode`
maps a stored `'collapse'` → `'normal'`. The current single-row preset is
`'collapsed'` — with "d" — a genuinely different value and behavior.)

## Decision

Keep the two mechanisms separate. **Do not add logic that auto-switches a track
to `displayMode: 'collapsed'` when data is dense.** The density-collapse is the
correct automatic behavior; the explicit preset is a user intent.

Auto-promoting `displayMode: 'collapsed'` for dense data would be strictly worse
than the density-collapse it would replace:

| | density-collapse (automatic) | `displayMode: 'collapsed'` (explicit) |
| --- | --- | --- |
| Scope | per run — only sub-pixel marks piled past a track height | all features, unconditionally |
| Wide features | still stack and label normally | forced onto the one row too |
| Labels | kept wherever they fit | all suppressed |
| Conveys density | yes — fades above the threshold | no |
| Trigger | on-screen width (zoom) × pile depth | user picks it |

The density-collapse preserves information the global preset throws away: it only
collapses marks that are sub-pixel *and* piled deeper than the track could show a
row each of (so nothing legible is lost), keeps labels where there's room, and
fades to *show* density rather than hiding it. A whole-track switch would drop
the names and single-row the wide features too.

The two also can't fight: `displayMode: 'collapsed'` takes the `singleRow`
early-out in `packPreparedRef`, which is *before* the depth gate — a collapsed
track is already one row, so the automatic collapse is moot there and never runs.
The fade still runs in that mode, because row 0 being the only row is exactly
where marks occlude each other.

## Consequences

When reading a "collapse" in this subsystem, disambiguate first:

- `singleRow` / `displayMode === 'collapsed'` → the explicit whole-track preset.
- `densityFade` / `isSubPixelFade` / `collapsedFeatureIds` /
  `DENSITY_COLLAPSE_DEPTH` → the automatic sub-pixel path.
- `flattenRows` → a caller asking for the whole-track single row without the
  label suppression `displayMode: 'collapsed'` comes with.
- `PILEUP_FADE_DEPTH` / `pileupFadeIds` → the fade, downstream of BOTH, reading
  only the committed rows.

**Revisit if:** a workload appears where dense data is *not* sub-pixel (so
density-collapse doesn't engage) yet a single-row overview is still wanted
automatically — e.g. many medium-width features that overflow the track height.
Even then, prefer extending the density-collapse's width/threshold heuristics
over auto-forcing the label-hiding global preset.

**Also revisit if `MIN_RECT_WIDTH_PX` or the row pitch moves.** Both thresholds
are calibrated against them — the fade's because a 2px clamp is what makes two
abutting marks overlap at all, the collapse's because it converts rows to pixels
of track.
