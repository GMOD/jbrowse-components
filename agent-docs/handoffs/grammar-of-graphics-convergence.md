---
name: grammar-of-graphics-convergence
description: The grammar thread as of 2026-09-24. Four rules for how far to take it (the parser's output is the data, one object per concept, generality resolves before the loop, a track stays its format and the grammar supplies its parts), a census of the copies between each gmod parser and its GPU buffer, Colin's calls of 2026-09-23 (Vega-Lite's mark/shape naming, a DOM text layer, colour stays per mark), and the work left — the copies, and the arc displays' colour object; shared y landed as scales.y.autoscaleGroup, the text mark as ADR-162. y2 was declined on captures. Read before proposing a grammar feature, or converging a display's colour ramp, rows or labels.
---

# Grammar of graphics: the convergence thread

On 2026-09-22 Colin asked whether going all-in on the grammar could be
"incredibly liberating". On 2026-09-23 he added two constraints: the data should
come straight from the adapters, meaning the `~/src/gmod/` parsers, with very
little transformation, and the answer should be a philosophy rather than a
feature list.

[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) maps what already
landed, stage by stage. This handoff holds the rules that rank the next work,
the census that tested the first rule, the work, and three proposals the thread
withdrew.

## Four rules

**1. The parser's output is the data.** The grammar reads each record where the
parser left it — bbi's typed arrays, a BAM record's bytes, CRAM's decoded slice,
vcf-js's variant — through a reader resolved once per region. The GPU instance
buffer is the one new representation the drawing needs, and any other copy
between the parser and that buffer needs a reason the drawing gives. ADR-152
found that every measured refusal to move a display onto the encoder blamed the
per-row feature object, never the grammar's rule.

**2. One object per concept, and every surface reads it.** Colour, the value
scale, the facet and the transform step are one object each (ADR-131, 135, 142,
150, 153): the painter, the shader's uniforms, the legend, the axis, the menu,
the dialog, the validator, the SVG export and the hit test all derive from it.
A display that spells one of those concepts its own way is the finding. The
ramp and text do not follow this rule yet; the row axis does on the multi-row
feature display, where the row table is the one object the shader, the
painter and the hit test place a key through
([ADR-165](../architecture-decision-records/adr-165-the-row-axis-rides-a-table-the-vertex-stage-samples.md)).

**3. Generality resolves before the loop.** A shape composes its scale at
`gen:shaders` (ADR-095), a field name becomes a direct read before the walk, a
domain rides a uniform, and a lane nobody asked for is never allocated. A
declared form lands at 1.00x the hand-written path or better, and anything
per-instance that a config does not name costs nothing.

**4. A track stays its format, and the grammar supplies its parts.** What a
format-typed display holds is layout, tiering and fetch shape, and none of those
are channels (ADR-091, and SESSION_SPEC_FORMAT.md §"The assessment"). The
grammar converges the parts every display shares, not the displays. A new mark
or channel arrives when it retires a hand-written spelling somewhere, which is
ADR-040's two-consumer bar stated as a goal.

## Decided on 2026-09-23

Colin's answers to the calls a Fable review of the mark display left open:

- **Vega-Lite's names.** A mark's kind is `mark` and the point symbol is
  `encoding.shape`, landed as
  [ADR-159](../architecture-decision-records/adr-159-a-mark-is-spelt-as-vega-lite-spells-one.md).
  The hosted `jbrowse.org/demos/read_marks/config.json` still spells `shape`:
  run `scripts/deploy-demo.sh demos/read_marks/config.json` when main next
  deploys,
  or the tutorial's live links fail to load.
- **The text layer draws DOM text on screen**, for accessibility. A label
  layer is sparse once overlaps are culled, so DOM costs little there; dense
  per-base text (sequence letters, MAF bases) stays on canvas and outside the
  layer. The placement rule is shared, and only the emit differs between the
  screen and the SVG export.
- **Colour stays per mark.** Scale members on each mark's `encoding.color` is
  Vega-Lite's own spelling, and marks declaring one alike already share a
  scale and a key. Only two open-ended ramps unioning one domain is missing,
  and nothing in the tree asks for it. A display-level `scales.color` would
  be a second spelling.
- **No `y2`.** Captured on the COLO829 tumour coverage over 1 Mb of hg19
  chr17, a range bar from each bin's `minScore` to its `maxScore` read worse
  to Colin than both of today's pictures: the mark display's mean bars with
  the min and max as point marks, and wiggle's whisker band. `origin` stays
  the display's slot.

## Withdrawn on 2026-09-23

These are recorded so the next session does not re-propose them from the same
chat.

- **Columns as the grammar's data model.** For BAM, VCF and GFF a column table
  would be a new representation between the parser and the instance buffer,
  which breaks rule 1, and the column-at-a-time jexl prototype measured that
  gathering fields off feature objects into columns gives most of the gain back
  ([evaluate-jexl-channels-a-column-at-a-time](../ideas/waiting-on-a-call/evaluate-jexl-channels-a-column-at-a-time.md)).
  ADR-152's 18x `bin` and 3.8x `coverage` kernel gains are measured against
  those steps over `SimpleFeature`s. Where a parser already answers columns —
  bbi, hic, CRAM's `DecodedSlice` — reading them by index is rule 1, not a new
  data model.
- **Per-layer data with a `lookup` join.** No measurement backs it, and each
  source multiplies the refName renaming, the byte gate and the zoom range a
  display runs once today. Manhattan's LD join carries index-SNP semantics that
  a generic `lookup` would not hold. It reopens when a named plot needs two
  files in one display.
- **Declared selections.** ADR-110's highlight-as-a-div measurement stands.
  Converging interaction state is
  [canvas-interaction-state-mixin](../ideas/ready/canvas-interaction-state-mixin.md).

## The census: what lies between each parser and its GPU buffer

Traced on 2026-09-23 through `~/src/gmod/` and the tree, file and line for each
hop; the ranking by data touched is inferred from typical region sizes, not
measured. No path hands the parser's arrays to the GPU unchanged. Hi-C and
wiggle come closest, and alignments, the feature display and VCF each turn
records into objects and then into typed arrays.

| Family | Parser answers | What the tree adds before the instance buffer |
| --- | --- | --- |
| BigWig → wiggle | `Int32Array` starts and ends, `Float32Array` scores (`bbi-js/src/block-view.ts`) | `processFeaturesFromArrays` interleaves the positions and copies the scores (`plugins/wiggle/src/util.ts:118`); the main thread builds per-source layers |
| BigWig → mark display | the same | a `BigWigFeature` object per row (`BigWigAdapter.ts:193`), collected into a `Feature[]`, encoded to lanes, a Flatbush; measured at 1.25–2.67x wiggle at screen scale, 0.04–0.45 ms a region ([MARK_ENCODING.md](../reference/MARK_ENCODING.md) §"The mark display over a BigWig, measured") |
| BAM / CRAM → pileup | `BamRecord` getters over the chunk; CRAM a (slice, index) view over typed columns. Our feature class is the parser's `recordClass`, so no wrapper | a `FeatureData` object per read, and a Mismatch, Gap or Insertion object per event, one per aligned base in the per-base modes (`plugins/alignments/src/features/*/extract.ts`), then typed arrays |
| VCF → variant displays | tabix a string per line; vcf-js a `Variant` with the first nine columns and INFO parsed, samples left in the line | five or six objects per variant on the matrix path (`VcfFeature`, its `data`, `FilteredVariant`, `simplifiedFeature`, `featureData`); genotypes scanned in place twice, not copied |
| BED / GFF3 / BigBed → feature display | bed-js an object with every column; GFF3 a lazy feature with raw attributes | BED spreads into a second object, then a `SimpleFeature` (`plugins/bed/src/util.ts:242`); the RPC builds a layout tree and a Rect, Line or Arrow object per primitive before `packRenderArrays` |
| Hi-C | typed arrays per block | the adapter concatenates every region pair into new arrays, even for one pair (`HicAdapter.ts:314`); the RPC writes the 12-byte instance buffer directly |

The encoder reads a plain field as `feature.get(ref)` through one reader per
channel (`packages/core/src/util/fieldReader.ts:27`), so its cost over any
adapter is the adapter's feature object. BAM's is the parser's own; BED's is
two copies deep.

## The work

### 1. One ramp table

Landed: every named ramp is a stop table in `packages/core/src/util/colorRamp.ts`
under a name in `COLOR_SCHEMES`, and `rampLutOf` there bakes a declaration's LUT once, bounded, as
`rampOverExtent` does for a ramp over a loaded extent. Hi-C's colour
is the `HicColor` object (`scale: linear | log`, `scheme`, `reverse`), which
retired `colorScheme` and `useLogScale`; its menu lists every scheme. LD paints
R² through `reds` and D′ through `blues` and declares no colour slot, since nothing asks to pick an LD ramp. Hi-C's percentile domain
is a domain rule of its own and stays the `useColorPercentile` slot.

The ramps to add were picked from captures on a Hi-C locus and a compartment
eigenvector (2026-09-23): `magma`, `inferno` and `cividis` beside viridis,
the diverging `redblue` and `purpleorange` (ColorBrewer's RdBu and PuOr), and
ColorBrewer's own stops under `reds` and `blues`. Plasma read as magma's
sibling and turbo is not perceptually uniform, so neither is in. A ramp dark
at its low end paints every sparse Hi-C bin a dark speck on the page, so
HicColor's `reverse`, left unset, turns one round (`darkAtLowEnd`).

### 2. y scales shared across tracks

Landed as `scales.y.autoscaleGroup` and the score menu's **Autoscale with other
tracks...** (GRAMMAR_OF_GRAPHICS.md §"Scale resolution across tracks"). No
tutorial step moved onto it yet: each pins a figure's scale on purpose, and
swapping one is a capture comparison first.

### 3. A text layer

Landed as
[ADR-162](../architecture-decision-records/adr-162-a-text-mark-is-a-dom-layer-placed-by-one-rule.md):
`mark: 'text'` with `encoding.text`, placed by `placeTextMarks` and emitted as
DOM on screen and `<text>` in the export through display-ui's `FloatingText`
and `SvgHaloText`, which the canvas feature labels and the arc labels' export
now emit through as well. What the emit shares is the typography; each
display's placement stays its own, and canvas's `labelPositioning.ts` moves
onto the mark display's rule only on a bench at parity, since its isoform
badges and scroll bucketing belong to that display. Still hand-painted on a
canvas: alignments' inline labels, synteny's off-screen mate names, MAF's row
labels and bases, variant insertion lengths and the sequence letters, the dense
per-base ones by the 2026-09-23 decision.

### 4. One row scale

This workstream is
[one-row-model-for-displays-that-stack-by-a-key](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md),
agreed and reviewed three times; its first two steps, and the third for
wiggle, landed. Rule 2 answers it with two objects rather than one: `rows`, the
row axis the dendrogram and the row labels are guides on (order, labels, the
tree, the clade focus), and `facet`, the labelled bands over it. Row colour is a
second scale on the colour object, not the row axis's range. Wiggle has moved:
its rows and a reader's arrangement of them are the `rows` config object, and a
colour set on one subtrack is `rowColor`
([ADR-157](../architecture-decision-records/adr-157-a-row-displays-arrangement-is-the-rows-config-object.md)).
The variant displays, the multi-row feature display and MAF have moved since,
and `TreeSidebarMixin` derives all four displays' rows.

### 5. The copies

Each row of the census is a rule-1 candidate, benched against the path it
replaces before it lands. In order of data touched: alignments' per-event
objects, the feature display's per-primitive objects and BED's second object,
Hi-C's single-pair concat, wiggle's interleave, VCF's per-variant objects. The
mark display over a BigWig reading bbi's view by index, rather than an object
per row, is the rule-1 form of ADR-152's column encoder, and ADR-152's two lane
fixes (no `featureIndex` when nothing reorders, a constant colour as a scalar)
still gate wiggle itself.

### 6. A `y2` channel — declined

Declined on 2026-09-23 (above): the range bar it would draw read worse than
the point marks and the whisker band that already exist. It reopens on a
config whose picture two point marks cannot give.

### 7. Colours still spelt outside the colour object

The alignments, feature, Manhattan, mark, wiggle, synteny and multi-way
displays resolve colour through `colorEncodingOf`. The arc displays are gone
(ADR-163): an arc is a `link` mark on the mark display, so its colour is the
mark colour object and its stroke the `size` channel. Hi-C's is the `HicColor`
object, LD's is named per metric, and the variant and multi-row row colours go
with the row scale. MAF's is the `MafColor` object, with identity on a
separate `y` channel.

## Order

The row model (§4) is under way, ahead of the rest: it converges code that
exists, which rule 2 ranks first. The ramp table and the `mark`/`shape`
rename have landed, and so has shared y. The text layer is next. The copies run beside any of them, one bench
each.
