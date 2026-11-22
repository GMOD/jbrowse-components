---
status: Proposed
summary: "Over genotype rows, `heightMode: 'grow'` is the declarative form of `+N hidden`: the records band takes its full-label stack, the rows keep the px `height` gives them, and the track grows past `height` up to `growMaxHeight`. Amends ADR-254"
---

# ADR-282: `heightMode: 'grow'` adds the records band over genotype rows

## Status

Proposed (2026-11-21). Colin, on a trio figure whose variant labels were
thinned away: "i dont like in static figure contexts not seeing all info".
On a fix that has jb2export call `showAllRecordRows()` once the view settles:
"i dont really like 'non-declarative expressions'".

Amends
[ADR-254](adr-254-the-multi-sample-variant-display-draws-a-stacking-records-band.md):
its "No cap" alternative, its opening settle, and its 2026-11-17 amendment
"`height` is the whole track", which reversed the 2026-10-31 "the band added".
That amendment's rejected row, "Keep `height` as the rows … the band extra",
does not apply here: `height` keeps one meaning, the track ungrown, and the
rows keep their px. Amends `reference/ROW_HEIGHT_AND_FIT.md` ("Against
`heightMode`"). Keeps
[ADR-257](adr-257-the-row-axis-owns-its-settings.md)'s split of the slots;
see Decision.

## Context

- Over genotype rows the records band comes out of the track's `height`:
  unset, it takes its stack up to 170 px and at most 170 of every 370 px under
  the chip strip (`RECORDS_SHARE`, `variantTopBands.ts`). Past that the fit
  ladder drops descriptions, thins bodies, decimates names and drops names;
  over rows the last rung hides whole records behind `+N hidden`
  (`hidesOverflow`).
- The ladder is right on screen, where `+N hidden`, hover and the seam drag
  get back what it dropped. None of them reaches a figure: `+N hidden` is a DOM
  chip (`BandChips.tsx`), the chip strip is cut from the SVG, and
  `renderSvg.tsx` draws only the band's paint layer.
- The case: the KHV trio's calls at chr1:191,659,504-191,659,654, six records,
  five within 12 bp, exported with `height:70` in a 3-sample card. One label
  of six drew, and the legend cut "Mendelian error" behind "+2 more".
  `height:100` drew three, `height:120` all six. The figure's author can find
  the number only by exporting each site and looking.
- `+N hidden` already does what the figure needs (`showAllRecordRows`): it
  writes `records.height` to the whole stack and raises `height` by as much,
  so the rows keep their px. It is an action, so it writes a number found at
  one moment, not a rule a config states.
- `heightMode` is the display's sizing slot, but over rows its description
  says "Otherwise it changes nothing" (`configSchema.ts:309`): `growMaxHeight`
  is Infinity there and `growTargetHeight` falls back to `fitTargetHeight`
  (`recordsBandViews.ts`).
- The written stance: ROW_HEIGHT_AND_FIT.md has no multi-row cell for a
  derived track height ("Multi-row displays get no `grow`"), and ADR-254
  rejected "the band always grows to its stack" because a dense SV region
  pushes the rows off screen and every pan shifts the tracks below. Both
  reasons are about the default on screen; an opt-in grow is capped, and pans
  that move the tracks below are what grow means on every display.

## Decision (proposed)

**`heightMode: 'grow'` over rows is `+N hidden` held as a rule.**

- **The band is its full stack**: the stack the ladder's `full` rung packs at
  scale 1, every record lettered, measured over the records on screen as
  records-only measures. Over rows `recordsMeasureIds` counts every fetched
  record today so the rows hold still between fetches; under grow the track
  moves anyway.
- **The rows keep exactly the px the same `height` gives them ungrown**:
  `height` minus the chip strip minus the band's ceiling there,
  `min(170, share)`, not its settled stack, so the rows hold still as the band
  grows. Under `rows.step: 'fit'` they divide that plot; with a pinned step
  they scroll in it, as today.
- **The track grows by the band's stack past that ceiling**, up to
  `growMaxHeight`, which stops being Infinity over rows and takes the
  display-kit default (800). A stack under the ceiling leaves the track at
  `height`.
- **`height` keeps one meaning**: the track, ungrown. A written
  `records.height` is ignored under grow, as `height` is on single-lane grow.
- **The slots stay split.** `heightMode` sizes the track in every state and
  `rows.step` the rows, and the rows never read the grown track.
  ROW_HEIGHT_AND_FIT.md predicted that gaining `grow` makes `heightMode` "the
  slot" for the rows too (ADR-257's rejected row); that assumed grow acts on
  the rows, which it does not here.
- **Every exit writes `'fixed'`** through `setHeightMode`, as single-lane
  displays leave grow: the track-edge drag already does (`resizeHeight` →
  `HeightModeMixin.resizeHeight`); the seam drag, `+N hidden` and a reset join
  it. The variant display overrides `setHeightMode` and
  `installGrowExitBake` to write `records.height` (the band as drawn) and
  `height` (the track as drawn) in one action. Today's bake writes `height`
  alone, and the band would snap back to its share.
- **Grow settles nothing**: `settleRecordsBandHeight` skips under grow, as the
  records-only opening height does.
- **The layouts follow `topBands`**: the records band in rows, the connectors
  band in columns, the section names under a records facet.
- **The tables host keeps its rule.** It has no window to stack records in, so
  its band stays `records.height` or the default, and the R export of a grown
  track lays out as an ungrown one.

**jb2export defaults a variant track with rows to `grow`** when the track
states none of `height`, `heightMode` or `records.height`, written into the
launch snapshot so the batch manifest's `spec` states it, as `adjust` writes
an alignments card's. Under the rows rule above, an unstated figure changes
only at sites whose stack exceeds the band's share: the sites that were losing
labels. A stated `height:N` draws today's figure, under the display's default
`heightMode: 'fit'`.

**That default writes `growMaxHeight: 500` beside `grow`.** The display-kit
800 lets one dense SV window make a card twice the default track. The
alignments card's 250 (`CARD_GROW_MAX_HEIGHT`) cannot serve: an unstated track
over rows is already 390, and `growMaxHeight` caps the whole track, so 500
leaves the band 110 px past its 170 default. A config that states
`heightMode: 'grow'` itself keeps the display-kit 800 unless it states
`growMaxHeight`, as on every display.

**What stays silent, for the reporting decision.** Grow shows every record and
label only under the cap. These still leave a figure without a trace, and the
separate reporting decision (jb2export's stderr warning, a batch-manifest
column, an SVG count, for every display) must name them:

- **The cap**: past `growMaxHeight` the band gives way to the ladder, and its
  last rung hides whole records.
- **Pinned rows past the plot**: at 2,504 samples and a pinned `rows.step` the
  rows are cut and scroll, and a figure shows no scroll.
- **Density collapse**: past `records.maxFeatureScreenDensity` the band packs
  into one unlabelled 15 px row, and grow measures that collapsed stack. Grow
  keeps the collapse: uncollapsing a window that dense would run into the cap
  anyway.
- **Label density**: past 0.2 records per pixel names go and past 0.1
  descriptions, as on a feature track, at any height. A zoomed-out figure
  loses its labels to this rule, not to the ladder.

Until that decision lands, a grown figure shows more, not everything.

## Consequences

- The trio card keeps `--track khv_trio_calls height:70` and adds
  `heightMode:grow`, or under the jb2export default states nothing. The rows
  draw as they do today, and the band takes what each site's stack needs.
- Pans resize a grown track on screen, as a grown feature track does: what
  ADR-254 rejected as a default, here by opt-in.
- `configSchema.ts`'s `heightMode` description loses "Otherwise it changes
  nothing" and gains the over-rows rule.
- ROW_HEIGHT_AND_FIT.md: the derived-track, pinned-item cell gains "multi-row
  `grow`: the bands above the rows derive the track; `heightMode` never sizes
  the rows". Derived/derived stays "none". The "no `grow`" bullet goes.
  VARIANTS_DISPLAY.md's "`growMaxHeight` is Infinity over rows" goes.
- On screen a drag leaves grow, and no menu item re-enters it over rows: the
  sizing items show only when the records are the display
  (`variantDisplayMenuItems.ts`). Grow over rows is a config and jb2export
  setting for now.
- By default the band's labels export as a raster `<image>`
  (`rasterizeLayers: !opts.noRasterize`, `renderRegion.ts`), where
  `LinearBasicDisplay` keeps label text vector. Separate, and worth its own
  decision.

## Alternatives

| Alternative | Why not |
| --- | --- |
| jb2export calls `showAllRecordRows()` once the view settles | the action writes `records.height` and `height`, so the session and the web export match, but as numbers found at one moment, not a rule a config states; no cap |
| `height` as the rows' plot under grow, the band extra | ADR-254's 2026-11-17 rejected row: `height` would mean the rows under grow and the track otherwise, flip again when the exit bake writes the grown track, and turn every unstated figure's 200 px of fit rows into 370 |
| `records.height: 'stack'` | a numeric `records.height` over rows trades px with the rows and the track holds still; `'stack'` would grow the track, one slot under two rules, where growing a track is `heightMode`'s on every display |
| `heightMode` as the one sizing slot for rows too (ADR-257's rejected row) | grow here never sizes the rows, so `rows.step: N \| 'fit'` still holds the rows' states alone |
| A taller fixed `height` per figure | a number found by exporting each site and looking; still silent when a site needs more |
| `records.height=N` per figure | the same guess, and the rows pay for it: at `height:120 records.height=80` they drew as slivers |
| Hide the rows (`genotypes.show=false`) | the band is then its stack up to 170, and the rows are the reason for the display |
| Grow by default on screen | ADR-254's reasons hold there: a dense SV window pushes the rows off screen and every pan shifts the tracks below |
| A default `rows.step` under grow | at 2,504 samples it overruns any cap and cuts rows, where fit draws them all sub-pixel |
| jb2export's grow default at the display-kit 800 | one dense SV window makes a card twice the default track |
| jb2export's grow default at the alignments card's 250 | under the 390 an unstated track over rows already is |
| Grow measures the uncollapsed stack past the density budget | a window that dense runs into the cap anyway |
