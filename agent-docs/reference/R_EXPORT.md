---
name: r-export
description: The R/ggplot2 exporter — where its code lives, what each display kind exports, the settled design decisions, the parity facts the R side has to hold, and the Rscript oracle. Read before changing it.
audience: internal
kind: spec
---

# R script export

An LGV view exports as a `.R` that redraws it from source: alignments through [ggjbrowse](https://github.com/GMOD/ggjbrowse), JBrowse's own engine in R ([TABLES.md](TABLES.md)), the other tracks through `rtracklayer`, and every plot in plain `ggplot2`. The view menu's **Export R script** item downloads it.

## Where the code is

All of it is in `plugins/marks/src/rexport/`, because the grammar's translator lives there and the other displays reuse its color, transform and layer code. `plugins/marks` cannot import from `plugins/canvas` or `plugins/alignments` without a cycle, so the three translators sit together and the exporter reads each display's config snapshot, not its model.

- `exportLinearView.ts` reads the live view (visible regions, each track's first display, adapter, the assembly's reference, refName aliases). `index.ts` adds the menu item through `addViewMenuItems`.
- `exportView.ts` dispatches by display type (`BUILTIN_EXPORTERS`) and assembles one script. A track no exporter reads, or one that throws, becomes a header note.
- `markToPlot.ts` + `transformR.ts` (`LinearMarkDisplay`), `wiggleToMarks.ts` (`LinearWiggleDisplay`, as the mark display that draws the same plot), `featureToPlot.ts` (`LinearBasicDisplay`, the gene glyph), `alignmentsToR.ts` (`LinearAlignmentsDisplay`, through ggjbrowse: the display's `color` and `filter` objects go to the engine as written, and each read comes back on its row, in its color, with the display's key).
- `rplot.ts` (typed plot model), `rScript.ts` (assembler), `frameFor.ts` (the `READERS` table: BigWig, GFF3, VCF, BED, BigBed, BAM), `rhelpers/*.R` bundled by `pnpm gen:rhelpers`.

Not exported yet: modifications and per-base colors, linked reads and chains, sort and facet on the alignments display, insertions and clips on reads, a key for a linear color ramp, the gene glyph's color by field, facet and compact modes, and `LinearManhattanDisplay` (no GWAS reader). Each lands in the script header when set.

The live path reads each display's resolved config (`fullConfSnapshot`), drops the empty strings, lists and objects an unset slot resolves to (`withoutUnset`), and hands the translators that. The translators keep their own defaults for the partial specs the unit tests build; a live export never needs them.

Two older branches hold work this does not: `r-export4-rebase` (the fidelity-first exporter with the CRAM, modification and sort helpers and oracles) and `r-export-rewrite` (**no remote**, `emitR.ts` and `figureSpec.ts`, which exist nowhere else; check before deleting an unpushed branch). Their per-display `exportRCode.ts` files read displays that no longer exist ([ADR-143](../architecture-decision-records/adr-143-one-quantitative-display-and-facet-is-the-layout.md), [ADR-157](../architecture-decision-records/adr-157-a-row-displays-arrangement-is-the-rows-config-object.md), [ADR-163](../architecture-decision-records/adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md)), so pull their `rhelpers/*.R` and oracles across rather than rebasing.

## Settled decisions

Reversing one means re-running the experiment that settled it.

- **The engine reads, plain ggplot2 draws.** Alignments come through ggjbrowse, which runs the browser's own adapters, layout and color pipeline in V8 and answers data frames: two review rounds found nearly every bug in a hand port of a browser rule (the BigBed reader, BED12 shapes, MAPQ bins, the insert-size band, the mismatch walk), and a table the browser computes cannot drift. What stays in the script is what a reader edits: the frames, the geoms and the scales. No black-box drawing function; `autoplot` is for ggjbrowse's own users.
- **Not pixel-perfect, by design.** Idiomatic R showing the same data beats matching JBrowse's rasterization (`IRanges::disjointBins` packing, approximate palette). The parity bar is the top tier only, numbers a user reads and semantic decisions ([SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) §"What actually has to agree").
- **No TS→R transpiler.** Machine-generated R is non-idiomatic. The `rhelpers/*.R` → `rHelpers.generated.ts` step bundles hand-written R verbatim for the browser; do not extend it into a translator.
- **A cumulative-bp axis, not `facet_grid`.** Multi-region exports concatenate regions on one axis, as LGV does. Facets are separate panels and cannot draw a geom *between* two, so cross-region read connectors need one axis.
- **The script names what it left out.** A track no panel read, a setting with no R counterpart, an untranslatable jexl filter each land in a header comment. A figure that quietly differs from the view it redraws is the failure.
- **Not the render IR's third consumer.** ggplot2 makes its own calls on snapping, min widths, alpha ramps and antialiasing, the layer ADR-051 keeps per-backend. What R shares with the GPU and Canvas2D backends is upstream: worker output and the semantic decisions in the RPC payloads and the `//! js-export` layer. A draw-level IR re-proposal cannot cite R export as its pull.

## The typed plot model

`rplot.ts` models a ggplot and renders it rather than pasting strings, because pasted mistakes pass the compiler and surface as a script that exits 0 with a quietly wrong picture. Three bugs are unrepresentable:

- **A second scale on one aesthetic.** ggplot silently replaces the earlier scale, so read bodies lost their coloring when mismatch ticks arrived. `scales` is keyed *by* aesthetic ([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md)'s rule from the R side).
- **A multi-statement read spliced into an assignment.** `x <- <block>` keeps only the first statement. A frame is a name plus statements; the renderer decides the binding.
- **An `aes()` naming a column the read never produced.** R finds it at draw time, only if that layer draws. `Aes<C>` finds it at `tsc`, but only with `NoInfer` on `layer()`'s `aes`; without it TypeScript infers `C` from the aes too and a typo widens the type to admit itself.

`xlim` is pinned per panel: otherwise each panel ranges over its own data, a read overlapping the right edge stretches the pileup past the coverage above it, and panels for one locus show different loci.

## The R helper library

One `.R` file per helper, named for the helper it defines, regenerated into a `HELPERS` table by `pnpm gen:rhelpers` with a `--check` mode in CI. The assembler reads needed helpers off the emitted code, so no dependency declaration can miss one.

A reader takes `(uri, chrom, start, end)` and returns a **genomic**-coordinate frame plus the fields the display names: `fieldsRead` collects every plain field a channel, step, facet or rows reads, and `frameFor` hands them over as GFF3 attributes (case-insensitive, as JBrowse matches) or VCF INFO keys under the dotted `INFO.DP` spelling. A column whose values all parse as numbers comes back numeric. A contig the index lacks reads as no rows, as the browser draws it. `read_gff` reads through the tabix index. `read_regions` is the only place genomic → cumulative happens; it clips features to the region only where there is more than one region, since the browser hands its transforms the unclipped feature.

**The region's `refName` has to be the file's spelling.** R has no assembly manager, so a view's `chr1` reaches a file indexed as `1` as a missing contig (CLAUDE.md §Names). `exportLinearView.ts` asks the assembly manager for each track's differing names, and `file_refname` translates at the read.

**A remote BAM needs its index passed.** The exporter passes `index` from the adapter's `index.location` (a CRAM's `craiLocation`), else `<file>.bai`; `read_bam`, which a mark display over a BAM still reads through, takes the same.

**An alignments track's settings go to the engine verbatim.** `rValue` writes the display's `color` and `filter` objects as R lists, ggjbrowse hands them to `alignmentTables`, and the engine resolves them through the display's own config schemas, so a setting the browser gains needs no translator. The script's `alignments_regions` lays each region's result onto the cumulative axis, drops a mismatch or coverage bin outside its region, as the old readers did, and keeps a read's `read` index per region for the overlays to join on. A read with no MD tag reads the reference under the assembly's name (`reference_chrom`), as the browser's `originalRefName` does.

**Categorical colors and shapes hash as the browser does.** A value with no listed entry takes `valueSlot`'s palette slot (a non-negative integer takes the slot it names anchored at 1, anything else hashes), which `category_values` ports and `exportViewR.test.ts` holds to `categoricalValueColor` over 200 strings. An unlisted value beside a partial `domain` hashes the same way, without the browser's collision avoidance, which depends on the order values streamed in. A facet's unlisted values keep a panel each after the listed ones.

**A mark with a zoom range draws only at the view's `bpPerPx`**, taken from the live view (lower bound inclusive, upper exclusive), so a figure shows the one mark the view showed.

**A BigBed reads through `read_bigbed`, not rtracklayer**, whose BigBed reader fails on any list column and so on every BED12 bigBed. It walks the file itself (chrom B+ tree, R-tree, zlib blocks, HTTP ranges through `curl` for a URL), and `exportViewR.test.ts` holds it to the BED12 file volvox.bb was built from. A BigBed's records group into genes by the adapter's `aggregateField` in `bed_features`, overlapping ones under one gene as `BigBedAdapter` groups them, and only within one region: grouping across the combined frame put every region's transcripts under the first region's gene and drew nothing in the others.

**A BED12 record takes `generateUcscTranscript`'s shape** in `bed_features`: a stranded coding record is CDS plus `five_prime_UTR`/`three_prime_UTR` parts, so `impliedUTRs: false` keeps the UTRs the browser draws; an empty thick range, or bigGenePred's `cdsStartStat`/`cdsEndStat` `none` with no `exonFrames` at or above 0 (every GENCODE transcript writes `none`), is a transcript of exons; an unstranded record, or any under `disableGeneHeuristic`, is plain blocks. A BigBed export reads those three columns for that reason.

**The header names a setting the config writes**, read off `getSnapshot` of the display config, not the resolved one: a resolved sub-schema carries its defaults, which made `modifications` a note on every alignments export. The alignments translator names every written slot outside the ones it reads and the ones that size the browser's track.

**A tabix file reads through the index its adapter names**, and a BAM always passes one; the readers default to `<file>.tbi`.

**A span or bar draws at least two figure pixels wide** (`MIN_MARK_PX`). The browser keeps every mark visible, and a 1 bp variant in a 5 kb window is under a device pixel in ggplot2.

## Parity facts

Each cost a wrong figure to find.

- **The overlays join on `.region` and `read` together.** The engine's `read` is a row of its region's reads, so it restarts at 1 in each region; `alignments_regions` keeps it as a column for that join.
- **Overlay rows outside a region are dropped, not clipped**, while a read's start and end are clipped. The engine answers whole reads and everything on them, so the helper trims a mismatch, gap or coverage bin outside the region for a lone region too, or a region alone and the same region beside another total differently.
- **The key is the display's, drawn through `scale_fill_identity`.** Each read carries its painted color, and `legend` lists the display's key rows, deduplicated by color since ggplot keys a color once; a bin no read falls in drops out of the figure's key as the identity scale trains on the data. A scheme the engine paints by repeating a color (the plain pair fill under several buckets) keeps one row for it.
- **Modifications and sort are the engine's to answer**, not a port's: the old `bam_modifications` and `sorted_pileup_layout` helpers and their oracles on the older branches mirrored `sortLayout.ts` and the modification walk by hand, which is the class of drift the engine route exists to end.
- **rtracklayer returns 1-based inclusive coords.** Every reader converts to 0-based half-open; one that did not left a 1bp hole between BigWig bins that antialiased into white seams.
- **`ggsave()` refuses a dimension over 50 inches**, and figure height is the unbounded sum of panel weights. Clamp it, or a large cohort dies at the script's last line after every read.
- **A one-row feature panel needs `expand_limits(y = 4)`**; a glyph is a fixed fraction of a row, so a short y-range lets the CDS rect fill the panel solid.

## Verification

Codegen string checks miss the bugs that matter. Run the *actual* generated script through `Rscript` against `test_data/volvox/*`, assert the figure exists, then run a probe script that calls one helper and asserts a known biological fact. Stripping MD from a BAM and requiring the reference path to reproduce the mismatches of `samtools calmd` against the same FASTA is the mismatch oracle, under an aliased contig too; `spliced.bam`'s own MD tags were written against another reference. The pileup rows match `placeRect` exactly, and the insert-size classes the counts the browser's estimator gives over the same reads.

`rScriptRun.test.ts` and `exportViewR.test.ts` each use one R session for every case, since attaching Bioconductor is slow, and skip themselves where R, its packages or ggjbrowse are absent. The `R export` workflow runs them on Ubuntu's apt R stack plus ggjbrowse from its GitHub main with `REQUIRE_R=1`, which turns that skip into a failure, on a push touching `rexport/` and nightly. Its Bioconductor is older than a researcher's, so a helper calling a newer function needs a fallback, as `bam_mismatches` falls back from `cigarillo` to `sequenceLayer`; and R's `sort()` collates by locale, so a probe that prints sorted names orders them itself.

## What the grammar supplies

A mark display's config is a ggplot spec in another dialect ([ADR-159](../architecture-decision-records/adr-159-a-mark-is-spelt-as-vega-lite-spells-one.md)): marks map to `geom_*`, encoding channels to `aes()`, channel scales to `scale_<aes>_*`, `transform[]` to base R over the frame the layer reads, `facet` to `facet_wrap`. What stays hand-written per display is what is not a channel (layout, tiering, fetch shape) plus alignments, whose overlays join by `read_index` and cannot use the generic region reader.

## The mark translator's rules

In `rexport/`: `rplot.ts` (plot model), `markToPlot.ts` (mark and channel stages), `transformR.ts`, `frameFor.ts`, `rScript.ts` (assembler).

- **The browser runs each region's transform steps alone.** An `aggregate` keys `.region` beside its groupby, and a `bin` on a shared axis aligns to genomic multiples of its width after removing the region's offset. An `auto` bin follows the figure's zoom through the display's `autoBinStep` ladder.
- **Facet steps run over each section alone**, `split` with `addNA` so a missing key is a section, not a dropped row. Every split rebinds through `bind_groups`, because `do.call(rbind, list())` is `NULL` and the browser draws an empty window as an empty panel. A facet over an empty window still dies, since `facet_wrap` refuses a frame with no rows.
- **`rows` draws as `facet_wrap`** in `domain` order and yields to a `facet` where both are set. A log axis cannot pin a bound at or below zero, so that end follows the data and the header says so.
- **A step or mark naming a column no stage produced is skipped and reported.** That check is a runtime one (`missingColumns`) and has to be: the step list is config, so `applyTransforms` can only answer `string[]` and `Aes<C>` widens to any string. The `NoInfer` check bites only where a frame's columns are literal.
- **Steps carrying a jexl callback** (`filter`, `formula`), structure a table does not hold (`flatten`, `mate`) and `rowColor` are reported in the header, not translated.
