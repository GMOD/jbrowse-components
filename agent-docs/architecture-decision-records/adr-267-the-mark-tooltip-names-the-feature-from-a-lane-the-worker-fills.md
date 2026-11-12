---
status: Accepted
summary: "The mark display's `tooltip` is `{ show, field }`; the worker reads `field` off each instance's whole feature into a `tooltip` string lane, through the feature displays' reader, and `MarkTooltip` prints it above the locus. The multi-row display's field defaults to `name`; the plain mark display's is empty"
---

# ADR-267: The mark tooltip names the feature from a lane the worker fills

## Status

Accepted (2026-11-12). Builds the parked idea ADR-249 left open (the tooltip
named no feature) and keeps ADR-238's `tooltip` spelling.

## Context

`MarkTooltip` printed the locus and each channel's value. The worker shipped
channels and no records, so hovering a ClinVar variant in a multi-row display
said `chr3:10,142,085..10,142,107 / ■ Pathogenic` and nothing that told one
variant from its neighbour. The feature displays name a feature through
`tooltip.field`, evaluated in the worker per feature (`collectRenderData`), and
ADR-238 settled that the part's `field` names the hover's first line.

## Decision

- **Config: the `tooltip` part, `{ show, field }`, a bare string the field.**
  `MarkTooltip` on `LinearMarkDisplay` (and the Manhattan display, which takes
  its schema) and `MultiRowTooltip` on `LinearMultiRowFeatureDisplay`, one
  schema with two defaults: empty, and `name`.
- **Worker: a `tooltip` string lane.** `MarkEncoding.tooltip` carries the
  field, `LaneName` gains `tooltip`, and `encodeFeatures` fills
  `EncodedChannels.tooltip` the way it fills `text`. It reads the field off
  `wholeFeatureRow`, so a flattened block names the feature a click on it
  opens, and through `tooltipTextReader` (core), which the feature displays'
  `tooltipReader` now calls: one field reads alike in both.
- **Request: only a mark a hover reaches asks for it** (`answersHover`, a
  `MARK_SPECS` `hit` other than `false`, so not `text`), and only while
  `tooltip.show` is on and the field is not empty (`tooltipField`).
- **Main thread:** `findMarkHit` copies the hovered instance's string into
  `MarkHitInfo.tooltip`, and `MarkTooltip` prints it first, through
  `SanitizedHTML` as `FeatureTooltip` does, since ClinVar's `_mouseOver` is
  markup. No string, no line. `show` off opens no box.
- **Default rule: a display whose plot is a mark per record names it by
  `name`; the plain mark display names nothing until its config writes a
  field.** The multi-row display draws one rect per feature record, and its
  records are what the reader hovers to identify. A name costs a few bytes a
  feature; a markup field such as `_mouseOver` costs more than the rect
  (below), so a config opts into it. `LinearMarkDisplay` is the grammar's
  blank page: its `marks` default is empty, and what it is configured with is
  mostly a value plot (bars over a score, coverage, a Manhattan, binned
  densities) whose instances number in the hundreds of thousands and whose
  bins have no name. An empty field there asks for no lane, so those plots
  pay nothing.

## Consequences

- The lane costs what the strings cost. Measured over UCSC's hg38
  `clinvarMain.bb` (`_mouseOver` else `name`, `v8.serialize` of the lane):

  | Window | Features | Mean chars | Lane bytes | Per feature | Clone | `name` alone per feature | x, x2, row, color lanes |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | chr17:43,044,295..43,125,483 (BRCA1) | 15,212 | 424 | 6.5 MB | 427 B | 11 ms | 14 B | 243 KB |
  | chr17:40–50 Mb | 54,432 | 387 | 21.2 MB | 390 B | 26 ms | 14 B | 871 KB |

  ClinVar's `_mouseOver` is an HTML block (review status, condition, star
  glyphs), about 27 times the rect's own lanes. The feature display ships the
  same string per feature where it draws them; the multi-row display also
  draws at zooms where the feature display shows density, so the default
  reads `name` and a config that wants the block writes
  `tooltip: '_mouseOver'`.
- A `tooltip` edit refetches, as any encoding edit does.
- `layerRequestsOf` and `markLayerRequest` take the field as an optional
  trailing parameter; a caller passing none (the multi-way synteny lanes) asks
  for no lane.

## Rejected alternatives

- **The feature tracks' default, `_mouseOver` else `name`, `function`, `id`,
  on the multi-row display**, which would name a ClinVar variant by its HGVS
  with no config. It ships the table's 427 B a feature, 27 times the rect, at
  every zoom the display draws; and reusing the feature displays' slot made
  `plugins/marks` depend on `plugins/features`.

- **A debounced `CoreGetEncodedFeature` per hover**, the parked idea's plan.
  `executeGetEncodedFeature` re-runs the region's layer steps for each call,
  so the name arrives late and the line flickers as the cursor crosses marks.
- **One default for both displays.** The feature tracks' default on
  `LinearMarkDisplay` puts a string per instance into dense value plots that
  have no name to show, or a read name per read where a mark display draws
  alignments.
- **A default keyed to the mark type**, names for `rect` and `link` and none
  for value marks. A written field that matches the default would then be
  ignored on a point, and the rule is invisible in the config.
- **The feature displays' `FeatureTooltip` part verbatim.** Its slot docs
  promise the description line and "Copy tooltip text", which the mark
  display does not draw.
