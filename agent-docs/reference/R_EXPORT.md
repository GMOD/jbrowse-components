---
name: r-export
description: The R/ggplot2 exporter — where its code lives, what each display kind exports, the settled design decisions, the parity facts the R side has to hold, and the Rscript oracle. Read before changing it.
audience: internal
kind: spec
---

# R script export

An LGV view exports as a `.R` that redraws it from source: feature, quantitative and alignments tracks through [ggjbrowse](https://github.com/GMOD/ggjbrowse), JBrowse's own engine in R ([TABLES.md](TABLES.md)), mark displays through `rtracklayer`, and every plot in plain `ggplot2`. The view menu's **Export R script** item downloads it.

## Where the code is

All of it is in `plugins/marks/src/rexport/`, because the grammar's translator lives there and the other displays reuse its color, transform and layer code. `plugins/marks` cannot import from `plugins/canvas` or `plugins/alignments` without a cycle, so the three translators sit together and the exporter reads each display's config snapshot, not its model.

- `exportLinearView.ts` reads the live view (visible regions, each track's first display, adapter, the assembly's reference, refName aliases). `index.ts` adds the menu item through `addViewMenuItems`.
- `exportView.ts` dispatches by display type (`BUILTIN_EXPORTERS`) and assembles one script. A track no exporter reads, or one that throws, becomes a header note.
- `markToPlot.ts` + `transformR.ts` (`LinearMarkDisplay`).
- `engineToR.ts` (`LinearBasicDisplay`, `LinearWiggleDisplay`) and `alignmentsToR.ts` (`LinearAlignmentsDisplay`): a ggjbrowse reader per track, then `ggplot(result)` and a `geom_jbrowse_*` per table, as ggjbrowse's own `autoplot` composes them.
- `rplot.ts` (typed plot model), `rScript.ts` (assembler), `frameFor.ts` (the mark displays' `READERS` table: BigWig, GFF3, VCF, BED, BigBed, BAM), `rhelpers/*.R` bundled by `pnpm gen:rhelpers`.

Not exported yet: linked reads and chains, facets on a feature track, a key for a linear color ramp, multi-sample variant displays (`jbrowse_variants` exists, no exporter calls it) and `LinearManhattanDisplay` (no GWAS reader). Each lands in the script header when set.

The live path reads each display's resolved config (`fullConfSnapshot`), drops the empty strings, lists and objects an unset slot resolves to (`withoutUnset`), and hands the translators that. The translators keep their own defaults for the partial specs the unit tests build; a live export never needs them.

Two older branches hold work this does not: `r-export4-rebase` (the fidelity-first exporter with the CRAM, modification and sort helpers and oracles) and `r-export-rewrite` (**no remote**, `emitR.ts` and `figureSpec.ts`, which exist nowhere else; check before deleting an unpushed branch). Their per-display `exportRCode.ts` files read displays that no longer exist ([ADR-143](../architecture-decision-records/adr-143-one-quantitative-display-and-facet-is-the-layout.md), [ADR-157](../architecture-decision-records/adr-157-a-row-displays-arrangement-is-the-rows-config-object.md), [ADR-163](../architecture-decision-records/adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md)), so pull their `rhelpers/*.R` and oracles across rather than rebasing.

## Settled decisions

Reversing one means re-running the experiment that settled it.

- **The engine reads, ggplot2 layers draw.** Feature, quantitative and alignments tracks come through ggjbrowse, which runs the browser's own adapters, layout and color pipeline in V8 and answers data frames: two review rounds found nearly every bug in a hand port of a browser rule (the BigBed reader, BED12 shapes, MAPQ bins, the insert-size band, the mismatch walk), and a table the browser computes cannot drift. The script draws them with ggjbrowse's geoms, one ordinary ggplot layer per table that takes any column in `aes()`, so a reader edits the geoms and scales as usual. No whole-figure call; `autoplot` is for ggjbrowse's own users.
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

A reader takes `(uri, chrom, start, end)` and returns a **genomic**-coordinate frame plus the fields the display names: `fieldsRead` collects every plain field a channel, step, facet or rows reads, and `frameFor` hands them over as GFF3 attributes (case-insensitive, as JBrowse matches) or VCF INFO keys under the dotted `INFO.DP` spelling. A column whose values all parse as numbers comes back numeric. A contig the index lacks reads as no rows, as the browser draws it. `read_gff` reads through the tabix index. For a mark display, `read_regions` is the only place genomic → cumulative happens; it clips features to the region only where there is more than one region, since the browser hands its transforms the unclipped feature.

**The region's `refName` has to be the file's spelling.** R has no assembly manager, so a view's `chr1` reaches a file indexed as `1` as a missing contig (CLAUDE.md §Names). `exportLinearView.ts` asks the assembly manager for each track's differing names, and `file_refname` translates at the read.

**A remote BAM needs its index passed.** The exporter passes `index` from the adapter's `index.location` (a CRAM's `craiLocation`), else `<file>.bai`; `read_bam`, which a mark display over a BAM still reads through, takes the same.

**An engine track's settings go to the engine verbatim.** `engineDisplay` hands the display's written config to the reader's `display` argument, less the slots that size the track or choose its bands (`HOST_SLOTS`), and the engine resolves it through the display's own schema, so a setting the browser gains needs no translator. The adapter crosses the same way: `engineSource` passes the file's path where ggjbrowse would choose that adapter from the extension, and the adapter config itself, locations resolved, where it carries a setting of its own (a BigBed's `aggregateField`, a multi-BigWig's subadapters) or a name that hides its format. A read with no MD tag reads the reference under the assembly's name (`reference_chrom`), as the browser's `originalRefName` does.

**Several regions bind through `jbrowse_regions`.** One region is read with a direct call, in genomic coordinates. Several are read one at a time and bound into one result of the same class, so the geoms draw it unchanged:
- each table's `start`, `end` and `position` move by the region's offset, and a row gains `.region`
- a span is cut to its region and a mark outside it dropped, so nothing draws across the gap
- `read`, `feature`, `subfeature` and `variant` count across regions, and a line's `run` stays its own
- keys list each entry once, a wiggle domain spans every region's, and `region` becomes the whole axis

**Categorical colors and shapes hash as the browser does.** A value with no listed entry takes `valueSlot`'s palette slot (a non-negative integer takes the slot it names anchored at 1, anything else hashes), which `category_values` ports and `exportViewR.test.ts` holds to `categoricalValueColor` over 200 strings. An unlisted value beside a partial `domain` hashes the same way, without the browser's collision avoidance, which depends on the order values streamed in. A facet's unlisted values keep a panel each after the listed ones.

**A mark with a zoom range draws only at the view's `bpPerPx`**, taken from the live view (lower bound inclusive, upper exclusive), so a figure shows the one mark the view showed.

**A BigBed mark display reads through `read_bigbed`, not rtracklayer**, whose BigBed reader fails on any list column and so on every BED12 bigBed. It walks the file itself (chrom B+ tree, R-tree, zlib blocks, HTTP ranges through `curl` for a URL), and `exportViewR.test.ts` holds it to the BED12 file volvox.bb was built from.

**The engine takes the config as written**, read off `getSnapshot` of the display config, not the resolved one: a resolved sub-schema carries its defaults, which would spell every default into the script. The resolved config decides only what the figure composes: which bands draw, the junction and allele floors, the fade.

**A tabix file reads through the index its adapter names**; a mark display's BAM always passes one, and the readers default to `<file>.tbi`.

**A span or bar draws at least two figure pixels wide** (`MIN_MARK_PX`). The browser keeps every mark visible, and a 1 bp variant in a 5 kb window is under a device pixel in ggplot2.

## Parity facts

Each cost a wrong figure to find.

- **An overlay's `read` indexes the bound reads.** The engine's `read` restarts in each region; `jbrowse_regions` counts it on across them, and a probe that joined on `.region` and `read` together would now join wrong.
- **A lone region keeps the engine's whole answer**, mismatches and coverage past its edges included, which `coord_cartesian` clips from the drawing. Compare two exports over the window, not by row count.
- **The key is the display's, drawn through `scale_fill_jbrowse`.** Each read carries its painted color, and the key lists the display's rows, labels sharing a color merged; a bin no read falls in drops out as the identity scale trains on the data.
- **Modifications and sort are the engine's to answer**, not a port's: the old `bam_modifications` and `sorted_pileup_layout` helpers and their oracles on the older branches mirrored `sortLayout.ts` and the modification walk by hand, which is the class of drift the engine route exists to end.
- **rtracklayer returns 1-based inclusive coords.** Every reader converts to 0-based half-open; one that did not left a 1bp hole between BigWig bins that antialiased into white seams.
- **`ggsave()` refuses a dimension over 50 inches**, and figure height is the unbounded sum of panel weights. Clamp it, or a large cohort dies at the script's last line after every read.
- **A feature panel's y axis is the display's pixels**, pinned to `c(0, height)`, and its height follows `height`: the engine lays the rows out, so the figure only has to keep its aspect.
- **A feature track exports at the view's `heightMode` and `height`.** The script writes both, so under the default `fit` it drops what the browser drops to fit the track, and a reader who wants every label edits one word to `grow`. ggjbrowse's own default is `grow`, since a figure has no track height.

## Verification

Codegen string checks miss the bugs that matter. Run the *actual* generated script through `Rscript` against `test_data/volvox/*`, assert the figure exists, then run a probe script that calls one helper and asserts a known biological fact. Stripping MD from a BAM and requiring the reference path to reproduce the mismatches of `samtools calmd` against the same FASTA is the mismatch oracle, under an aliased contig too; `spliced.bam`'s own MD tags were written against another reference. The pileup rows match `placeRect` exactly, and the insert-size classes the counts the browser's estimator gives over the same reads.

`rScriptRun.test.ts` and `exportViewR.test.ts` each use one R session for every case, since attaching Bioconductor is slow, and skip themselves where R, its packages or ggjbrowse are absent. The `R export` workflow runs them on Ubuntu's apt R stack plus ggjbrowse from its GitHub main with `REQUIRE_R=1`, which turns that skip into a failure, on a push touching `rexport/` and nightly. Its Bioconductor is older than a researcher's, so a helper calling a newer function needs a fallback; and R's `sort()` collates by locale, so a probe that prints sorted names orders them itself.

## What the grammar supplies

A mark display's config is a ggplot spec in another dialect ([ADR-159](../architecture-decision-records/adr-159-a-mark-is-spelt-as-vega-lite-spells-one.md)): marks map to `geom_*`, encoding channels to `aes()`, channel scales to `scale_<aes>_*`, `transform[]` to base R over the frame the layer reads, `facet` to `facet_wrap`. What stays hand-written per mark display is what is not a channel (layout, tiering, fetch shape).

## The mark translator's rules

In `rexport/`: `rplot.ts` (plot model), `markToPlot.ts` (mark and channel stages), `transformR.ts`, `frameFor.ts`, `rScript.ts` (assembler).

- **The browser runs each region's transform steps alone.** An `aggregate` keys `.region` beside its groupby, and a `bin` on a shared axis aligns to genomic multiples of its width after removing the region's offset. An `auto` bin follows the figure's zoom through the display's `autoBinStep` ladder.
- **Facet steps run over each section alone**, `split` with `addNA` so a missing key is a section, not a dropped row. Every split rebinds through `bind_groups`, because `do.call(rbind, list())` is `NULL` and the browser draws an empty window as an empty panel. A facet over an empty window still dies, since `facet_wrap` refuses a frame with no rows.
- **`rows` draws as `facet_wrap`** in `domain` order and yields to a `facet` where both are set. A log axis cannot pin a bound at or below zero, so that end follows the data and the header says so.
- **A step or mark naming a column no stage produced is skipped and reported.** That check is a runtime one (`missingColumns`) and has to be: the step list is config, so `applyTransforms` can only answer `string[]` and `Aes<C>` widens to any string. The `NoInfer` check bites only where a frame's columns are literal.
- **Steps carrying a jexl callback** (`filter`, `formula`), structure a table does not hold (`flatten`, `mate`) and `rowColor` are reported in the header, not translated.
