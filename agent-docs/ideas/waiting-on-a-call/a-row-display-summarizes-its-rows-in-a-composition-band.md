---
name: a-row-display-summarizes-its-rows-in-a-composition-band
description: A band above a row display's rows that stacks, per column, the share of the drawn rows in each colour category, painted with the cells' own colour object. It is the coverage band's reading moved onto a row facet. MAF already has it, as its coverage band; the multi-sample variant display lacks it and gets it first, replacing the parked scalar summary strip; the graph overview gets it from the same painter once a second host exists. It arrives as a band, not as a grammar mark, because the mark display's stack was declined on 2026-09-30 and nothing hand-written in the encoder would retire. Read before adding a summary strip, a frequency band or a stacked share to any row display.
---

# A row display summarizes its rows in a composition band

Draft, 2026-10-03. Folds in and
supersedes
[a-per-site-summary-strip-is-a-scalar-band-on-the-coverage-anchor](a-per-site-summary-strip-is-a-scalar-band-on-the-coverage-anchor.md)
if accepted. Paths are relative to `~/src/jbrowse-components` unless they name
another repository.

## What the band draws

The haplotype overview mockup (`~/src/gmod/gbz-base-js/tools/overview/render.ts:186-199`)
draws a 40 px strip over 464 haplotype rows. Per x-bin, the strip stacks the
share of rows that are variant, partial, reference-like and absent, in the
colours the rows below use. The eye reads where the population diverges
without counting a column, which a heatmap of 464 rows cannot give.

A multi-sample VCF and a MAF ask the same question of their rows: per site, how
many samples carry the alt, how many were called; per column, how many species
match, mismatch or are missing.

## The concept in grammar terms

The band is a stat over the row facet, not a new mark:

- **data**: the rows the display draws, after filter, focus and hidden rows;
- **transform**: per x-unit, `aggregate count` grouped by the cell's colour
  category, divided by the drawn row count (Vega-Lite's `stack: "normalize"`);
- **scale**: y is `[0, drawn rows]`, fixed, not autoscaled; colour is the cells'
  categorical scale, the same object the legend reads;
- **mark**: a rect per (x-unit, category), drawn from the band's baseline;
- **guide**: none of its own. The cells' key already names every colour the band
  paints, and a 0/50/100 % tick column states the scale.

Read that way, the band is the alignments coverage band applied to rows instead
of reads. The coverage band's bar is the reads present at a position and its
coloured segments are those reads' share by base
(`packages/alignments-core/src/snpCoverage.ts:1-16`, the shader's
`coverageSnp.slang:13-21` reading). The composition band's bar is the rows
present, and its segments are those rows' share by category. MAF already makes
that move: its coverage band counts species rows with a base at each column and
stacks their mismatches by base, through alignments-core's own pipeline
(`plugins/maf/src/LinearMafGetAlignmentDataRpc/buildMafCoverageRegion.ts:26-50`).

## What the tree already has

| Piece | Where | What it gives |
| --- | --- | --- |
| Band contract and fold | `packages/core/src/util/bandLayout.ts:62` (`stackBands`), ADR-096 | off spends 0 px; reserver and painter read one fold |
| Variant band fold | `plugins/variants/src/shared/variantTopBands.ts:142` (`['lane', 'lineZone']`), read at `MultiSampleVariantBaseModel.ts:1285` | the slot the band joins |
| Variant lane painter | `plugins/variants/src/LinearMultiSampleVariantDisplay/components/VariantLaneOverlay.tsx:158-195` | a Canvas2D `OverlayCanvas` band over the rows, the precedent for the painter |
| Variant cell key | `plugins/variants/src/shared/variantLegend.ts:90-140` (`absentDataEntries`, `altEntries`, `getGenotypeEntries`); colours at `shared/constants.ts:40-50`, `shared/cellFill.ts:16` | the categories and colours the band must paint |
| Per-variant hue | `shared/paintCells.ts:38` (`paintFeatureColors`), `LinearMultiSampleVariantDisplay/model.ts:415` (`regionFeatureColors`), ADR-203 | the alt segment's colour under a `color` field |
| Per-site class tally | `plugins/variants/src/shared/genotypeClassCounts.ts:54` | `ref/alt/hom/het/mis` per sample; a jexl filter's helper today, not drawn |
| MAF coverage band | `plugins/maf/src/LinearMafDisplay/stateModel.ts:1078` (fold), `configSchema.ts:204` (`showCoverage`, on by default) | this band, for MAF, already |
| MAF conservation band | `plugins/maf/src/LinearMafDisplay/components/conservationBand.ts:14-90`, `configSchema.ts:232` | a single-category share (match / classifiable rows), with a 0/50/100 % axis on `coverageLayout`'s insets |
| Density tier | `packages/core/src/data_adapters/BaseAdapter/featureDensity.ts:8`, `plugins/canvas/src/shared/densityBand.ts:32-60`, ADR-102, ADR-117 | a precomputed scalar band standing in for refused features, Canvas2D everywhere |
| Graph overview bins | `~/src/gbz-haplotype-index/src/overview.rs:436-454` | per bin `[absent, reference, partial, variant, excursions, sv, max_bp]`, at 5 levels |

## The decline it has to clear

`agent-docs/reference/GRAMMAR_OF_GRAPHICS.md:84` says the stack is declined and
asks that nobody re-propose it. Colin declined the stacked bar on its captures
on 2026-09-30 (`fff09f4b0c`): a `stack` step and a bar `y2` lane on the mark
display, read against the mirror and the rows form.

This proposal adds neither the step nor the lane. The band belongs to the
displays that host it, as the coverage band's SNP stack belongs to alignments
and MAF, and it never enters `markEncodingTypes.ts` or `runTransforms`. The
difference from the declined picture is the population: the declined stack
split a count of features, whose total moves bin to bin, while this band
splits a fixed set of rows, so every bar spans the same height and the share is
the reading.

The layout answers the stacked bar's usual fault, a floating middle segment, by
order. Carrier categories stack up from the baseline, missing categories hang
from the top edge, and the reference category fills the middle as the
remainder. With one carrier class and one missing class, which covers most
views, both read from an edge. Two carrier classes (het under hom, or alt under
other alt) leave one floating, as the coverage band's base stack does.

**Colin's call**: whether the 2026-09-30 decline covers this band. If it does,
the fallback is the rows form the grammar guide already shows: one thin scalar
strip per category, each on its own baseline. That fallback costs a band per
category and more height.

## Rule 4: what it retires

Rule 4 (`GRAMMAR_OF_GRAPHICS.md:40-46`) governs a new mark or channel. This band
adds neither to the encoder, so the rule does not fire, and nothing
hand-written in the encoder would retire if it did. Claiming otherwise would
dress a band up as a grammar feature. It lands under
`agent-docs/mechanisms/feature-band-consumers.md` instead: "a band with two
hosts belongs in a package; a band with one host borrows from the plugin that
owns the vocabulary, and moves when a second host appears."

What it does replace, concretely:

- **The parked strip's design.** The strip offered carrier count, alt allele
  frequency and call rate as three exclusive menu choices, each its own pass.
  The composition answers carrier share (carrier segments) and call rate (the
  top edge of the reference segment) in one picture, and in phased mode, where
  a row is a haplotype, the carrier segment is the alt allele frequency over
  the drawn haplotypes. The strip's three-way menu and its scalar pass never
  get built.
- **The overview tool's hand painter** (`gbz-base-js/tools/overview/render.ts:186-199`)
  as the product's picture. The Node PNG tool keeps its own painter; the
  plugin's large view draws through the shared one.
- **Nothing in MAF.** ADR-199 keeps the conservation band MAF's own, and its
  codon mode has no row-category reading. The MAF coverage band already is this
  band.

## The mapping per display

| | Multi-sample variants, allele count | Multi-sample variants, phased | MAF | Graph overview |
| --- | --- | --- | --- | --- |
| row | sample | haplotype | species / haplotype | haplotype |
| x unit | variant, at its span (`variantCellSpanPx`); a matrix column in the matrix layout | same | bp (binned by the coverage pipeline) | overview bin (4 kb × 4^level) |
| carrier categories, from baseline | hom alt, het | alt, other alt | mismatch by base (A/C/G/T/N) | variant (marks bucket optional), partial |
| remainder | hom ref | reference | match | reference-like |
| missing, from top | no call | no call, unphased | gap / no row (unpainted headroom) | absent |
| colours from | `getGenotypeEntries`; the alt segment takes `regionFeatureColors` under a `color` field | same | `palette.bases`, read by both rows and band | the host's cell scale |
| stat runs | main thread, over `featureGenotypeMap` codes and drawn rows | same | worker, in `computeMafCoverage`, over the narrowed row set | client, over fetched class cells; index bins when no row is drawn |
| reach | the rows' byte gate | same | the rows' fetch; the summary tier past 20 kb | whole chromosome |

A VCF category list of ref / alt / other alt / no call holds for phased mode
only. Allele-count mode splits het from hom by dosage, and
the key names those two swatches (`variantLegend.ts:111-119`); a triploid
`0/0/1` falls in het. Phased mode adds unphased.

## Where the stat runs, and the precomputed case

Each host computes the counts where its cells already live. The band adds no
fetch and must not refetch when toggled, the property the variant lane was
built to keep:

- **Variants** count on the main thread over the interned genotype codes the
  model already holds (`MultiSampleVariantBaseModel.ts:187-190` reads them for
  the anchored sort), restricted to the drawn rows, in a computed beside
  `regionCellColors`. ADR-203 measured a main-thread pass over the non-reference
  cells of 1,000 variants by 3,000 samples at 15-30 ms; a count over all cells
  costs more. Measure before landing.
- **MAF** already counts in the worker, over the rows the request narrowed to
  (`buildMafCoverageRegion.ts:15-20`).
- **Graph** reads its cells from `HaplotypeOverviewClasses` to draw the rows,
  so it counts from those cells: 3,800 bins by 464 rows on whole chr1 is 1.8 M
  nibbles. `HaplotypeOverviewBins` already holds the same counts over every
  haplotype, at every level, so the band reads them directly only when no
  rows are drawn (rows collapsed, band alone) or no row is filtered or hidden.
  The precomputed counts do not split variant by mark bucket, so a
  bucket-split band needs the cells.

The precomputed case is therefore the density tier's shape (ADR-102): a
stand-in read when the rows are absent, never a second source while they are
drawn. A precomputed count over every haplotype that disagrees with the drawn
rows after a filter is the failure to avoid. For VCF, the precomputed analogue
would be a categorical sibling of `densityAdapter`, such as a per-bin class-count
sidecar. The multi-sample display reads no density tier today
(`MultiSampleVariantBaseModel.ts:688-691`, "Byte-only — no density axis"), so
past the byte gate both the rows and the band give way to the banner. That
sidecar is out of scope here.

The claim that VCF stops at about 1 Mb on HPRC was not measured for this
draft; the gate is a byte budget, not a span (ADR-102), so the point varies by
callset.

## The band's API

Four pieces, each already a pattern in the tree:

1. **Data**, a plain shape per region:
   `RowComposition { x: Uint32Array; x2: Uint32Array; counts: Uint32Array /* n × k */; drawnRows: number; categories: readonly CompositionCategory[] }`,
   where a category is `{ id, color, role: 'carrier' | 'remainder' | 'missing' }`.
   `x`/`x2` are bp for genomic layouts and column indices for the matrix. A
   per-column colour override (`altColor?: Uint32Array`) carries the variant
   hue under a `color` field.
2. **Stat**, one pure function per host, owned by the host. Variants:
   `genotypeComposition(codes, drawnRowIndices, renderingMode)`. Graph:
   `overviewComposition(cells, drawnRows)` or `fromOverviewBins(bins)`. No
   shared stat function: the categories differ by display, and a generic
   `classify(row, column)` callback per cell is the per-instance closure rule 3
   refuses.
3. **Colour**, read from the host's colour object, not restated. Variants build
   the categories from the same table `getGenotypeEntries` lists, so a palette
   edit, a `color.labels` edit or the shading toggle moves cell, key and band
   together. The band adds no `ColorScale` to `colorScales`, so the legend gains
   no entry (ADR-108). Rule 2 (`GRAMMAR_OF_GRAPHICS.md:26-33`) is the
   constraint here: a band palette of its own is the finding.
4. **Paint and place**: one Canvas2D painter, `paintComposition(ctx, data, blocks, { bandHeight })`,
   which is also the SVG export (the density band and the variant lane are
   Canvas2D for the same reason). Its value box is `coverageLayout(height)`
   (`packages/alignments-core/src/coverageBandBox.ts:20`), as the conservation
   band's is, so its 0/50/100 % ticks sit where MAF's do. The host adds a
   `composition` key to its `stackBands` fold; variants place it directly above
   the rows, `['lane', 'lineZone', 'composition']`, because in the matrix layout
   its x is the plot's column, not the genome (the parked strip's reasoning,
   kept).

Slots, per `feature-band-consumers.md`: `showComposition` (off by default, so
no committed figure moves) and `compositionHeight` (default 40), bounded
through `clampBandHeight`, with a `BandSeamHandle` at its seam. Hover writes the
display's one hover slot with the column's counts per category, its row fields
left empty, as a lane hit does.

The painter and the data type start in `plugins/variants`. They move to a
package (display-kit or render-core) when the graph plugin becomes the second
host, since the plugin lives out of tree and needs a public export.

## Declined and out of scope

- **`stack` and `y2` on the mark display.** Declined 2026-09-30; this proposal
  does not reopen them.
- **A shared stat or a band registry.** `feature-band-consumers.md` §"Where it
  stops" refuses both; each host owns its fold and its counts.
- **GPU passes.** At most a few thousand columns by six categories, Canvas2D
  suffices. Reusing the coverage band's SNP pass would need a width lane (it
  hard-codes 1 bp, `coverageSnp.slang:43`) and a categorical lane table in
  place of the base-named slots (`coverageBand.slang:288`, `coverageBand.ts:134`);
  take that up only if a measurement asks for it.
- **A new MAF band.** MAF has this band. Its one gap is that the coverage
  domain autoscales to the peak depth (`stateModel.ts:1574-1586`), so missing
  rows read as a shorter bar, not as headroom against the row count. A
  `[0, rows]` domain option is a separate, small item.
- **Bucket-split variant segments in the graph band** at stage one; the
  mockup's band used one variant colour too.
- **A VCF class-count sidecar** for views past the byte gate.

## Staged plan

1. **Multi-sample variants, genomic layout.** First because its design is
   already parked, its counts are on the main thread with no worker change,
   its fold and its Canvas2D band precedent (the lane) sit in the same file,
   and HPRC VCFs give a population large enough to need it. Lands with a
   sabotage test in `variantTopBands.test.ts` that pins the order, a parity test
   holding band colours to `getGenotypeEntries`, and the ADR-203-sized
   measurement.
2. **The matrix layout**, with x as column index.
3. **Move the painter and data type to a package** and draw the graph overview's
   band from it in jbrowse-plugin-graphgenomeviewer's large view, counting from
   the fetched cells.
4. **Optional**: the MAF `[0, rows]` coverage domain, and a VCF class-count
   sidecar, each on its own trigger.

## Risks

- The decline. If the 2026-09-30 call reads as "no stacked bars anywhere", the
  composition band is the rows form, and the design above changes only in its
  painter and its height.
- Cost on cohort callsets: counting every cell of 1,000 × 3,000 on the main
  thread on each filter change. Memoize per region and per drawn-row set; never
  per pan.
- Overdraw in the genomic layout: at zoomed-out views many variants share a
  pixel, and the band overdraws as the cells do. A binned mode is a later
  option, not a stage-one need.
- A precomputed count read while rows are filtered silently disagrees with the
  rows. The host decides the source from the drawn-row set, never from the zoom.

## Open questions for Colin

1. Does the stacked-bar decline cover a fixed-population share band, or is the
   rows form the answer here too?
2. Should missing categories (no call, absent) paint as headroom from the top,
   or as an unpainted gap so the bar's top edge reads as call rate, the way the
   coverage band reads depth?
3. Under a `color` field (impact, SV class), should the het and hom alt segments
   take the variant's hue at the key's two dosage shades, or one full hue?
4. Which display hosts the graph overview's rows: a plugin display, the
   multi-way synteny display's large-view mode, or the mark display with
   `rows`? The band's data contract holds for any of them; the package move in
   stage 3 waits on the answer.
5. Naming: "composition band", "summary band", or "genotype share" in the menu?
