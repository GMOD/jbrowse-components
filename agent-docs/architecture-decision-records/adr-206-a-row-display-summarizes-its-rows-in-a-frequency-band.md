---
status: Accepted
summary: "The multi-sample variant display gains a genotype frequency band directly above its rows (`showGenotypeFrequencies`, `genotypeFrequenciesHeight`, off by default): per variant, the share of the drawn rows in each genotype class, carriers from the baseline, missing calls from the top edge, the reference grey between. It counts each column's non-reference cells by class, dosage and painted colour, so every colour mode follows with no category table and a recolour recounts without a refetch. Each cell ships its `CELL_*` class byte. The band is a band, not a grammar mark: the 2026-09-30 stack decline stands for the mark display, and this band splits a fixed population. MAF's 0–100% ticks move to alignments-core as `percentAxisTicks`, which both share bands read"
---

# ADR-206: A row display summarizes its rows in a frequency band

## Status

Accepted (2026-10-03). Replaces two parked proposals, the composition band and
the per-site summary strip, both deleted. Narrows the stack decline in
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) §"Gaps against the
grammar" to the mark display.

## Context

A genotype matrix answers who carries a variant, cell by cell, but not how many:
on a few hundred rows the eye cannot count a column. The haplotype overview
mockup in `~/src/gmod/gbz-base-js/tools/overview/render.ts` answered it with a
strip stacking, per bin, the share of rows in each class. MAF already draws the
same reading as its coverage band.

The stacked bar was declined on its captures on 2026-09-30 (`fff09f4b0c`): a
`stack` step and a bar `y2` lane on the mark display, splitting a count of
features whose total moves bin to bin. Colin judged on 2026-10-03 that a
fixed-population share has compelling uses the decline did not weigh.

## Decision

- **A band in the variant fold, directly on the rows**
  (`['lane', 'lineZone', 'frequencies']`, `shared/variantTopBands.ts`), since
  its x is the rows' own: a column's span at genomic positions, a column index
  in the matrix, which the connector zone above it ties back to a position.
  Both layouts draw it, from one Canvas2D painter the SVG export re-runs.
- **It counts what the cells paint.** `countFrequencyColumns`
  (`shared/frequencyBand.ts`) walks each column's non-reference cells on drawn
  rows and groups them by class, dosage and final painted colour; the drawn
  rows left over are the reference remainder, painted the reference grey the
  rows show. Carriers stack from the baseline by dosage, the remainder sits in
  the middle, and unphased and no-call hang from the top edge. Grouping by the
  painted colour, never ordering by it, makes the band a view of the cells'
  colour object: impact, SV type, a record field, a `jexl:` colour and a phase
  set's hues all follow with no table per mode, and it adds no `colorScales`
  entry.
- **Each cell ships its class**, `cellCategories`, the `CELL_*` index the
  styler already computed for the legend's painted mask. The tooltip needs it to
  tell an other alt from an alt and unphased from no call.
- **The tooltip speaks the key's words.** `GENOTYPE_CLASS_LABELS`
  (`shared/variantLegend.ts`) names the key's rows and the tooltip's counts.
- **Whole-pixel edges, with a 1px floor** for any carrier or missing class, so a
  singleton among hundreds of rows still shows; the remainder gives up what the
  floors take.
- **One 0–100% axis producer.** `percentAxisTicks` in alignments-core, on the
  coverage box, serves MAF's conservation band and this one; the display
  answers `axes`, and the chrome draws it on screen and in the export.
- **A boolean and a height, the band contract's inputs** (ADR-096), as
  alignments' `showCoverage` and MAF's `showConservation` are. Asked whether
  the grammar could carry this instead of another boolean: a declared mark
  cannot, since the encoder runs over features in the worker and the band's data
  is the main-thread set of drawn rows in their painted colours; a `bands` list
  would be the same booleans with an order the fold ignores. The grammar's
  share is inside the band: the colour object, the key's labels and the shared
  axis.

## Consequences

- Off by default, so no committed figure moves.
- A count costs 35 ms over 3 million non-reference cells (1,000 variants by
  3,000 samples, every cell a carrier) and 4 ms at one cell in twenty, under
  jest, against 8 ms and 0.4 ms for the row placement the same payload pays. It
  reruns when data lands, on a recolour and on a reorder, never on a pan.
- A focus or a filter refetches, since the row set is a fetch input; the band
  counts the payload that lands, and a cell on a row the display no longer
  draws (`HIDDEN_ROW`) is not counted.
- A cell costs one byte more on the wire.
- The band summarizes every drawn row, not each facet group. A band per row
  band waits on a reader asking for it.
- Zoomed out, columns overdraw as the cells do: the last variant painted in a
  pixel shows.
- Where it grows, each on its trigger: the painter and `FrequencyColumns` move
  to a package when the graph overview becomes a second host (which display
  hosts those rows is open); MAF's coverage band could take a `[0, rows]`
  domain so missing rows read as headroom; a per-bin class-count sidecar would
  carry the band past the byte gate.

## Rejected alternatives

- **Categories built from the key's table** (`getGenotypeEntries`). A second
  spelling of the cells' colours, and blind to a `jexl:` colour and a phase
  set, which the key cannot enumerate.
- **Counting every cell's genotype code on the main thread.** Pays for the
  reference cells the remainder already answers, and restates the colours.
- **A scalar strip with a three-way menu** of carrier count, allele frequency
  and call rate. The stack shows carrier share and call rate in one picture,
  and in phased mode the carrier segment is the allele frequency.
- **The coverage band's GPU SNP pass.** It hard-codes a 1 bp width and
  base-named slots; a few thousand columns by a handful of classes do not need
  it.
