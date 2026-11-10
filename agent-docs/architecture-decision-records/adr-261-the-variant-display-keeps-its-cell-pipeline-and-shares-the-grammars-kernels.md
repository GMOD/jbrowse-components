---
status: Rejected
summary: "Rejected replacing `LinearVariantDisplay` with a `LinearMarkDisplay` spec of a records mark over a flattened genotype mark: its picture is more than a plot, it already speaks the grammar's objects, and it shares the grammar's kernels instead"
---

# ADR-261: The variant display keeps its cell pipeline and shares the grammar's kernels

## Status

Rejected (2026-11-09). Colin, on the review of the parked idea
`variant-display-as-grammar`: "if it is a full rejection we can make it an
adr", and "i do want to aim for the ideal rather than hacky intermediaries".
The idea doc is retired into this record. Its measurement, a declared spec of
the RHD structural-variant picture timed against the display at 3,202 samples,
was never run: the review found that no result of it decides the port. It can
be reconsidered; the conditions are below.

## Context

The idea read the variant display as two ggplot2 layers over one table with a
shared x: a rect and a text mark per record, packed, over a tile per record and
sample. It proposed writing that as a `LinearMarkDisplay` spec (a `pileup` rect
over a `flatten` of `samples`), and replacing the display once the spec matched
its speed.

The display already holds the grammar's objects wherever the two share a
concept:

- **Rows** are display-kit's `rowsWithStepConfigSchema`, the base the mark
  display's `rows` extends too (ADR-257).
- **Color, filter, facet and Edit plot** are the grammar's: `encoding.color`
  through display-kit's `colorConfigSchema`, the `filter` predicate list
  (ADR-238), `facet`, and a `plot` a reader edits (`plotExamples.ts`).
- **Drawing** goes through render-core's `defineMark` (`variantMarks.ts`,
  `variantMatrixMarks.ts`), with a `cell` shape of its own.
- **The bands** stack through core's `stackBands` (`variantTopBands.ts`), as
  the MAF display's do, and the records band consumes the feature display's
  pipeline ([feature-band-consumers.md](../mechanisms/feature-band-consumers.md)).
- **Clustering** runs through tree-sidebar's `applyClusterRun`, and the SVG
  export through display-kit's `renderDisplaySvg`.

What is its own is the genotype path (`VariantRPC/`, `computeVariantCells.ts`,
the `cell` shape and its two shaders), the records band's rules, the hit tests,
the legend and the menus.

## Why the port is hard

- **The picture is more than a plot.** A display becomes a mark-display subtype
  only when its whole picture is a plot
  ([GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md), rule 2), as
  Manhattan is
  ([ADR-178](adr-178-manhattan-is-the-mark-display-with-a-default-plot.md)).
  The variant display holds what a plot does not: the records ladder that
  decimates and hides ([ADR-254](adr-254-the-multi-sample-variant-display-draws-a-stacking-records-band.md)),
  the opening heights ([ADR-255](adr-255-one-variant-display.md)), the density
  gate, a reference-cell tier that is a fetch input, the anchored haplotype
  sort, phase sets read through `processFormatFields`, and mixed ploidy
  ([VARIANTS_DISPLAY.md](../reference/VARIANTS_DISPLAY.md)).
- **The speed was never the gate.** The mark display reached
  1.06-1.26x<!--m:typed-sources-maf-display.typedVsMaf.range--> of the MAF
  display's time on MAF rows, and the MAF display stayed its own for what it
  draws past the cells
  ([ADR-199](adr-199-the-maf-display-stays-its-own-and-shares-the-grammars-kernels.md)).
  A variant spec at 1.00x would leave the same question open.
- **A `flatten` over `samples` runs on `Feature`s.** Typed tables cover MAF and
  BigWig alone, and the same fan-out over MAF rows was several times slower
  than the display's own pack
  ([ADR-190](adr-190-the-maf-display-stays-off-the-feature-steps.md)) until
  typed lanes carried it. The genotype path holds codes, never strings, and
  keys nothing by sample name
  ([MULTI_SAMPLE_VARIANTS.md](../reference/MULTI_SAMPLE_VARIANTS.md)); a typed
  VCF table has to reproduce that before a declared spec can be timed fairly.
- **A cell's color takes two inputs.** `fill = shade(hue(variant, cell),
  dosage)`: the record gives the hue and the cell's called alleles the shade,
  painted on the main thread so a recolor refetches nothing
  ([ADR-203](adr-203-the-variant-cells-hue-resolves-on-the-main-thread.md)).
  render-core's color is one field through one scale, the limit
  [ADR-227](adr-227-the-wiggle-display-keeps-its-shapes-and-shares-render-cores-kernels.md)
  met with a row and a value. A cell's alpha also follows zoom where records
  share pixels (`densityFade.ts`).
- **Two of its pictures have no declared form.** The columns layout draws one
  equal-width column per ALT, and the grammar has no ordinal x. A
  `rows: 'haplotype'` row is one called allele of a sample, which a `flatten`
  keyed by sample does not fan out.

## What it would have bought

The genotype path's files, against the grammar growing a typed VCF table, a
two-input color, an ordinal x, an allele fan-out and a band stack on the mark
display. The records band, the hit tests, the legend and the menus stay either
way. Nothing a reader sees: Manhattan gained facets, rows, transforms and Edit
plot from its port, and the variant display has those.

## Decision

- **`LinearVariantDisplay` stays the VariantTrack's display type**, with its
  genotype path, its `cell` shape and its bands.
- **A concept the grammar also has takes the grammar's object**, as it does
  today, and a new variant setting takes the mark vocabulary's spelling where
  one exists. A concept found spelled twice converges on one implementation,
  the faster of the two, as ADR-199 has the MAF display do.
- **The mark display grows a genotype plot when a track declares a need for
  one**, not to retire this display. There is one genotype path today, and a
  second one built to parity would be the two-path state the MAF display is
  in.

## When to reconsider

- A track declares a plot over genotypes the display cannot draw: a summary
  over samples, a second layer. That is also the "declared plot over VCF slow
  on real data" a typed VCF table waits on.
- A second display needs a color from two fields, which gives ADR-227's channel
  its second user.
- A declared plot wants equal-width columns, the trigger GRAMMAR_OF_GRAPHICS.md
  names for an ordinal x.

## Rejected alternatives

- **The first move as written**, a `flatten` spec over `Feature`s timed against
  the display. ADR-190 already measured that shape on MAF rows; the result
  would have been read as a verdict on the grammar when it is one on `Feature`
  rows.
- **The records band alone on declared marks.** It would leave two fetches and
  two hit tests in one display, the state ADR-227 declined for bars and points
  first; the band already composes the feature display's pipeline.
- **A genotype path in the mark display, brought to parity first.** Two paths
  drawing one picture, kept in step by a bench, with no track asking for the
  second.
