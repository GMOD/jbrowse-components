---
name: r-export
description: The R/ggplot2 exporter — where its code lives, what each display kind exports, the settled design decisions, the parity facts the R side has to hold, and the Rscript oracle. Read before changing it.
audience: internal
kind: spec
---

# R script export

An LGV view exports as a self-contained `.R` that redraws it from source in `rtracklayer` plus base `ggplot2`. The view menu's **Export R script** item downloads it.

## Where the code is

All of it is in `plugins/marks/src/rexport/`, because the grammar's translator lives there and the other displays reuse its color, transform and layer code. `plugins/marks` cannot import from `plugins/canvas` or `plugins/alignments` without a cycle, so the three translators sit together and the exporter reads each display's config snapshot, not its model.

- `exportLinearView.ts` reads the live view (visible regions, each track's first display, adapter, the assembly's reference, refName aliases). `index.ts` adds the menu item through `addViewMenuItems`.
- `exportView.ts` dispatches by display type (`BUILTIN_EXPORTERS`) and assembles one script. A track no exporter reads, or one that throws, becomes a header note.
- `markToPlot.ts` + `transformR.ts` (`LinearMarkDisplay`), `wiggleToMarks.ts` (`LinearWiggleDisplay`, as the mark display that draws the same plot), `featureToPlot.ts` (`LinearBasicDisplay`, the gene glyph), `alignmentsToR.ts` (`LinearAlignmentsDisplay`).
- `rplot.ts` (typed plot model), `rScript.ts` (assembler), `frameFor.ts` (the `READERS` table: BigWig, GFF3, VCF, BED, BigBed, BAM), `rhelpers/*.R` bundled by `pnpm gen:rhelpers`.

Not exported yet: modifications, CRAM, linked reads and chains, sort and facet on the alignments display, indels, clips and splice gaps on reads, the gene glyph's color by field, facet and compact modes, and `LinearManhattanDisplay` (no GWAS reader). Each lands in the script header when set.

The live path reads each display's resolved config (`fullConfSnapshot`), drops the empty strings, lists and objects an unset slot resolves to (`withoutUnset`), and hands the translators that. The translators keep their own defaults for the partial specs the unit tests build; a live export never needs them.

Two older branches hold work this does not: `r-export4-rebase` (the fidelity-first exporter with the CRAM, modification and sort helpers and oracles) and `r-export-rewrite` (**no remote**, `emitR.ts` and `figureSpec.ts`, which exist nowhere else; check before deleting an unpushed branch). Their per-display `exportRCode.ts` files read displays that no longer exist ([ADR-143](../architecture-decision-records/adr-143-one-quantitative-display-and-facet-is-the-layout.md), [ADR-157](../architecture-decision-records/adr-157-a-row-displays-arrangement-is-the-rows-config-object.md), [ADR-163](../architecture-decision-records/adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md)), so pull their `rhelpers/*.R` and oracles across rather than rebasing.

## Settled decisions

Reversing one means re-running the experiment that settled it.

- **No bespoke R package.** A `ggjbrowse` wrapper made the emitted script a black box the reader cannot tweak with ordinary ggplot2 knowledge. Everything emits as small visible inline helpers.
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

**A remote BAM needs its index passed.** Rsamtools finds the index only beside a local file, so `read_bam`, `bam_coverage` and `bam_mismatches` take `index` and the exporter fills it from the adapter's `index.location`, else `<bam>.bai`.

**Categorical colors and shapes hash as the browser does.** A value with no listed entry takes `valueSlot`'s palette slot (a non-negative integer takes the slot it names anchored at 1, anything else hashes), which `category_values` ports and `exportViewR.test.ts` holds to `categoricalValueColor` over 200 strings. An unlisted value beside a partial `domain` hashes the same way, without the browser's collision avoidance, which depends on the order values streamed in. A facet's unlisted values keep a panel each after the listed ones.

**A mark with a zoom range draws only at the view's `bpPerPx`**, taken from the live view (lower bound inclusive, upper exclusive), so a figure shows the one mark the view showed.

**A BigBed reads through `read_bigbed`, not rtracklayer**, whose BigBed reader fails on any list column and so on every BED12 bigBed. It walks the file itself (chrom B+ tree, R-tree, zlib blocks, HTTP ranges through `curl` for a URL), and `exportViewR.test.ts` holds it to the BED12 file volvox.bb was built from. A BigBed's records group into genes by the adapter's `aggregateField` in `bed_features`, overlapping ones under one gene as `BigBedAdapter` groups them, and only within one region: grouping across the combined frame put every region's transcripts under the first region's gene and drew nothing in the others.

**A BED12 record takes `generateUcscTranscript`'s shape** in `bed_features`: a stranded coding record is CDS plus `five_prime_UTR`/`three_prime_UTR` parts, so `impliedUTRs: false` keeps the UTRs the browser draws; an empty thick range, or bigGenePred's `cdsStartStat`/`cdsEndStat` `none` with no `exonFrames` at or above 0 (every GENCODE transcript writes `none`), is a transcript of exons; an unstranded record, or any under `disableGeneHeuristic`, is plain blocks. A BigBed export reads those three columns for that reason.

**The header names a setting the config writes**, read off `getSnapshot` of the display config, not the resolved one: a resolved sub-schema carries its defaults, which made `modifications` a note on every alignments export. The alignments translator names every written slot outside the ones it reads and the ones that size the browser's track.

**A tabix file reads through the index its adapter names**, and a BAM always passes one; the readers default to `<file>.tbi`.

**A span or bar draws at least two figure pixels wide** (`MIN_MARK_PX`). The browser keeps every mark visible, and a 1 bp variant in a 5 kb window is under a device pixel in ggplot2.

## Parity facts

Each cost a wrong figure to find.

- **The `read_index` join is by value, within a region.** `read_index` is the position in `readGAlignments` order that `read_bam` carries, so a frame subset keeps the join valid: `read_filter` drops reads and the overlays follow. It restarts at 1 in each region, so the mismatch overlay joins on `.region` and `read_index` together, and each region's coverage keeps only that region's reads, through the `region` argument `read_regions` hands a reader that takes one.
- **Overlay rows outside a region are dropped, not clipped**, while a read's start and end are clipped.
- **MD is optional in BAM, so mismatches take two paths:** the MD walk, and a projection of the read onto the reference for a read without the tag, as `BamAdapter` does. An MD-only walk drew no SNP ticks on an MD-less file and reported nothing. The reference is a FASTA *or* a 2bit, read under the view's contig name, not the BAM's alias for it. The projection writes an intron as `.` and a deletion as `-`, neither of them a base.
- **Rsamtools cannot read CRAM.** Each panel decodes the region to a temp BAM via samtools, which restores MD. Given `-T`, samtools uses only that fasta, and a JBrowse assembly routinely pairs a no-prefix fasta with refname aliases, so `cram_to_bam` retries unaided with the ENA md5 service as `REF_PATH`. A published CRAM's own `UR` header is usually a dead producer path and modern htslib does not fall back.
- **Insert-size coloring is median ± 3·1.4826·MAD** over primary proper pairs, JBrowse's robust estimator, not mean ± sd (a band with no width colors nothing, widened to at least 2× and at most 0.5× its centre, and a TLEN of 0 is never short). Read-level colors come from the browser's fixed category table, which repeats colors on purpose: a categorical path that deduplicates near-equal colors shifts them, so those go through a manual scale. Mapping quality paints the browser's threshold bins, taken at export time from `colorEncodingOf` over core's `MEASURE_FIELD_PRESETS.mapq`, with MAPQ 255 in the plain fill.
- **JBrowse paints one modification call per reference column**: the most likely over every MM group on the read, an earlier group holding a tie. A row per type draws twice at every cytosine of a combined `C+mh` code.
- **Simplex is the whole game for modBAM denominators.** An ONT modBAM's MM groups are `C+m` with no `-` partner, so only the examined strand was basecalled, and dividing by every read carrying the base halves every bar. Detection runs over the whole dataset, so the R side pools the parsed `<sign><type>` pairs across regions as an *attribute*, not a column, to survive the `min_prob` row filter. Any row subset drops attributes, so read it before subsetting.
- **Mirror `sortLayout.ts`.** `sortByMapWithUnknownsLast` puts reads with the sorted-on feature first and reads without it last for base and interbase, **not for `tag`**, where a missing tag is `0`/`""` and sorts among the rest. Interbase keys on an exact column match, unlike the base sort's deletion *span* test. A tag sort goes numeric only when **every** value parses. Every branch returns an ascending numeric key with `Inf` meaning "no key", so a descending criterion keys negative.
- **rtracklayer returns 1-based inclusive coords.** Every reader converts to 0-based half-open; one that did not left a 1bp hole between BigWig bins that antialiased into white seams.
- **`ggsave()` refuses a dimension over 50 inches**, and figure height is the unbounded sum of panel weights. Clamp it, or a large cohort dies at the script's last line after every read.
- **A one-row feature panel needs `expand_limits(y = 4)`**; a glyph is a fixed fraction of a row, so a short y-range lets the CDS rect fill the panel solid.

## Verification

Codegen string checks miss the bugs that matter. Run the *actual* generated script through `Rscript` against `test_data/volvox/*`, assert the figure exists, then run a probe script that calls one helper and asserts a known biological fact. Cross-implementation oracles run the real JS and the R helpers over identical data and assert read-for-read agreement (`computeSortedLayout` against `sorted_pileup_layout`, the modification readings against `bam_modifications`, `read_base_counts` against `Rsamtools::pileup()`). Stripping MD from a BAM and requiring the reference path to reproduce the mismatches of `samtools calmd` against the same FASTA is the mismatch oracle; `spliced.bam`'s own MD tags were written against another reference. The pileup layout matches `placeRect` exactly, with the `pileup` step's `padding: 2` reproducing its 2bp gap between reads sharing a row.

`rScriptRun.test.ts` and `exportViewR.test.ts` each use one R session for every case, since attaching Bioconductor is slow, and skip themselves where R is absent. The `R export` workflow runs them on Ubuntu's apt R stack with `REQUIRE_R=1`, which turns that skip into a failure, on a push touching `rexport/` and nightly. Its Bioconductor is older than a researcher's, so a helper calling a newer function needs a fallback, as `bam_mismatches` falls back from `cigarillo` to `sequenceLayer`; and R's `sort()` collates by locale, so a probe that prints sorted names orders them itself.

## What the grammar supplies

A mark display's config is a ggplot spec in another dialect ([ADR-159](../architecture-decision-records/adr-159-a-mark-is-spelt-as-vega-lite-spells-one.md)): marks map to `geom_*`, encoding channels to `aes()`, channel scales to `scale_<aes>_*`, `transform[]` to base R over the frame the layer reads, `facet` to `facet_wrap`. What stays hand-written per display is what is not a channel (layout, tiering, fetch shape) plus alignments, whose overlays join by `read_index` and cannot use the generic region reader.

## The mark translator's rules

In `rexport/`: `rplot.ts` (plot model), `markToPlot.ts` (mark and channel stages), `transformR.ts`, `frameFor.ts`, `rScript.ts` (assembler).

- **The browser runs each region's transform steps alone.** An `aggregate` keys `.region` beside its groupby, and a `bin` on a shared axis aligns to genomic multiples of its width after removing the region's offset. An `auto` bin follows the figure's zoom through the display's `autoBinStep` ladder.
- **Facet steps run over each section alone**, `split` with `addNA` so a missing key is a section, not a dropped row. Every split rebinds through `bind_groups`, because `do.call(rbind, list())` is `NULL` and the browser draws an empty window as an empty panel. A facet over an empty window still dies, since `facet_wrap` refuses a frame with no rows.
- **`rows` draws as `facet_wrap`** in `domain` order and yields to a `facet` where both are set. A log axis cannot pin a bound at or below zero, so that end follows the data and the header says so.
- **A step or mark naming a column no stage produced is skipped and reported.** That check is a runtime one (`missingColumns`) and has to be: the step list is config, so `applyTransforms` can only answer `string[]` and `Aes<C>` widens to any string. The `NoInfer` check bites only where a frame's columns are literal.
- **Steps carrying a jexl callback** (`filter`, `formula`), structure a table does not hold (`flatten`, `mate`) and `rowColor` are reported in the header, not translated.
