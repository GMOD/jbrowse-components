---
name: r-export
description: The unlanded R/ggplot2 exporter — which branch holds what, the part main invalidated and the part it did not, the settled design decisions, the parity facts the R side has to hold, and the Rscript oracle. Read before restarting it.
audience: internal
kind: spec
---

# R script export

An LGV view exports as a self-contained `.R` that redraws it from source in `rtracklayer` plus base `ggplot2`. No exporter is on main. The `r-export` branch carries the mark-display translator (`git show r-export:plugins/marks/src/rexport/`) and grows on its own so it does not land dead code. Two older branches hold work the translator does not: `r-export4-rebase` (the fidelity-first exporter) and `r-export-rewrite` (the idiomatic-first one, unpushed).

## Where the code is

| branch | holds |
| --- | --- |
| `r-export` | the mark-display translator, its `Rscript` suite and `pnpm gen:rhelpers` |
| `r-export4-rebase` | `rhelpers/*.R`, `exportR.ts` (assembler, helper-dependency closure), nine per-display `exportRCode.ts` fragments, the equivalence oracles, a figure gallery |
| `r-export-rewrite` (**no remote**) | `rplot.ts` (now also on `r-export`), plus `emitR.ts` and `figureSpec.ts`, which exist nowhere else |

`R_export4` and `R_export4-pre-rebase` are superseded by `r-export4-rebase`; the remote `R_export4` was force-updated and is not a backup of the local ref. Check before deleting an unpushed branch.

Main invalidated only the per-display `exportRCode.ts` family, since each reads one display model's getters and several of those displays are gone: the multi-wiggle folded into `LinearWiggleDisplay` ([ADR-143](../architecture-decision-records/adr-143-one-quantitative-display-and-facet-is-the-layout.md), `facet` half superseded by [ADR-157](../architecture-decision-records/adr-157-a-row-displays-arrangement-is-the-rows-config-object.md)), the multi-sample matrix display folded into `LinearMultiSampleVariantDisplay`, and the arc displays became a `link` mark ([ADR-163](../architecture-decision-records/adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md)). The R helpers, assembler, oracles and `rplot.ts` are R-side or format-side and survive. Pull those across rather than rebasing.

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

- **A second scale on one aesthetic.** ggplot silently replaces the earlier scale, so read bodies lost their colouring when mismatch ticks arrived. `scales` is keyed *by* aesthetic ([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md)'s rule from the R side).
- **A multi-statement read spliced into an assignment.** `x <- <block>` keeps only the first statement. A frame is a name plus statements; the renderer decides the binding.
- **An `aes()` naming a column the read never produced.** R finds it at draw time, only if that layer draws. `Aes<C>` finds it at `tsc`, but only with `NoInfer` on `layer()`'s `aes`; without it TypeScript infers `C` from the aes too and a typo widens the type to admit itself.

`xlim` is pinned per panel: otherwise each panel ranges over its own data, a read overlapping the right edge stretches the pileup past the coverage above it, and panels for one locus show different loci.

## The R helper library

One `.R` file per helper, named for the helper it defines, regenerated into a `HELPERS` table by `pnpm gen:rhelpers` with a `--check` mode in CI. Real `.R` files avoid TS-template escaping, and the test R-`parse()`s every file and `sys.source()`s the library to prove each defines exactly its own helper. The assembler reads needed helpers off the emitted code (every `HELPERS` name called in frames, plots, region layout, then in those helpers' bodies), so no dependency declaration can miss one.

A reader takes `(uri, chrom, start, end)` and returns a **genomic**-coordinate frame plus the fields the display names: `fieldsRead` collects every plain field a channel, step, facet or rows reads, and `frameFor` hands them over as GFF3 attributes (case-insensitive, as JBrowse matches) or VCF INFO keys under the dotted `INFO.DP` spelling. A column whose values all parse as numbers comes back numeric. A contig the index lacks reads as no rows, as the browser draws it. `read_gff` reads through the tabix index. `read_regions` is the only place genomic → cumulative happens; it clips features to the region only where there is more than one region, since the browser hands its transforms the unclipped feature.

**The region's `refName` has to be the file's spelling.** R has no assembly manager, so a view's `chr1` reaches a file indexed as `1` as a missing contig (CLAUDE.md §Names). The wiring that hands `assembleRScript` its regions owes that translation.

## Parity facts

Each cost a wrong figure to find.

- **The `read_index` join is index-based.** Overlays join via `reads$row[x$read_index]`, the position in `readGAlignments` order. **Never drop rows from `reads`**; `read_filter` marks a `keep` column and the layout leaves a filtered read at an NA row, which ggplot omits. Multi-region renumbers each region's `read_index` into the combined frame before concatenating.
- **Overlay rows outside a region are dropped, not clipped**, while a read's start and end are clipped.
- **MD is optional in BAM, so mismatches take two paths:** the MD walk, and a sequence-layer projection against the reference for a read without the tag, as `BamAdapter` does. An MD-only walk drew no SNP ticks on an MD-less file and reported nothing. The reference is a FASTA *or* a 2bit.
- **Rsamtools cannot read CRAM.** Each panel decodes the region to a temp BAM via samtools, which restores MD. Given `-T`, samtools uses only that fasta, and a JBrowse assembly routinely pairs a no-prefix fasta with refname aliases, so `cram_to_bam` retries unaided with the ENA md5 service as `REF_PATH`. A published CRAM's own `UR` header is usually a dead producer path and modern htslib does not fall back.
- **Insert-size colouring is median ± 3·1.4826·MAD** over primary proper pairs, JBrowse's robust estimator, not mean ± sd.
- **JBrowse paints one modification call per reference column**: the most likely over every MM group on the read, an earlier group holding a tie. A row per type draws twice at every cytosine of a combined `C+mh` code.
- **Simplex is the whole game for modBAM denominators.** An ONT modBAM's MM groups are `C+m` with no `-` partner, so only the examined strand was basecalled, and dividing by every read carrying the base halves every bar. Detection runs over the whole dataset, so the R side pools the parsed `<sign><type>` pairs across regions as an *attribute*, not a column, to survive the `min_prob` row filter. Any row subset drops attributes, so read it before subsetting.
- **Mirror `sortLayout.ts`.** `sortByMapWithUnknownsLast` puts reads with the sorted-on feature first and reads without it last for base and interbase, **not for `tag`**, where a missing tag is `0`/`""` and sorts among the rest. Interbase keys on an exact column match, unlike the base sort's deletion *span* test. A tag sort goes numeric only when **every** value parses. Every branch returns an ascending numeric key with `Inf` meaning "no key", so a descending criterion keys negative.
- **rtracklayer returns 1-based inclusive coords.** Every reader converts to 0-based half-open; one that did not left a 1bp hole between BigWig bins that antialiased into white seams.
- **`ggsave()` refuses a dimension over 50 inches**, and figure height is the unbounded sum of panel weights. Clamp it, or a large cohort dies at the script's last line after every read.
- **A one-row feature panel needs `expand_limits(y = 4)`**; a glyph is a fixed fraction of a row, so a short y-range lets the CDS rect fill the panel solid.
- **Labels decimate like `fitWidth`:** centre-to-centre against combined half-widths, since long features stacked in one window have near-identical centres however wide each box is.
- **`GRanges` has no `[[`**; read metadata via `mcols(g)[[nm]]`.

## Verification

Codegen string checks miss the bugs that matter. Run the *actual* generated script through `Rscript` against `test_data/volvox/*`, assert the figure exists, then run a second probe script that calls one helper and asserts a known biological fact (the ctgA:1693 C-SNP, the `RG:Z:4` split in `volvox-rg.bam`).

Cross-implementation oracles run the real JS and the R helpers over identical data and assert read-for-read agreement: `computeSortedLayout` against `sorted_pileup_layout`, both of the browser's modification readings against `bam_modifications` over every modBAM in `test_data`, `mod_coverage` against `computeModificationCoverage`, `read_base_counts` against `Rsamtools::pileup()`. Stripping MD from a BAM and requiring the reference path to reproduce the MD path's mismatches is the mismatch oracle.

One layout difference is intended: `placeRect` leaves a 2bp gap between reads sharing a row and the R helper packs on strict overlap, so equivalence fixtures span the sort column to give every read its own row.

`rScriptRun.test.ts` uses one R session for every case, since attaching Bioconductor is slow, and skips itself where R is absent, **which is every CI run**: treat it as a local gate. Pure string assertions would have caught none of its defects (CSS-versus-hex ramp colour, `df_1 <- df_1`, a dropped base read, an aggregate naming `start` twice). `probeFrame` builds the frame a mark reads and asks R what it holds.

## What the grammar supplies

A mark display's config is a ggplot spec in another dialect, so the exporter no longer needs a dialect per display ([ADR-159](../architecture-decision-records/adr-159-a-mark-is-spelt-as-vega-lite-spells-one.md) names it Vega-Lite's way, the same lineage as ggplot2):

| config | ggplot2 |
| --- | --- |
| `marks[].mark`, `linkShape` | `geom_*` |
| `marks[].encoding.{x,y,color,shape,size,text}` | `aes()` |
| a channel's `{scale, domain, range, scheme}` | `scale_<aes>_*` |
| `transform[]` (`bin`, `aggregate`, `coverage`, `pileup`) | base R over the frame the layer reads |
| `facet` | `facet_wrap` |
| `scales.y` | `scale_y_*`, `coord_cartesian` |
| `rows`, `rowColor` | the row axis and its second colour scale |

What stays hand-written per display is what is not a channel (layout, tiering, fetch shape; [SESSION_SPEC_FORMAT.md](SESSION_SPEC_FORMAT.md) §"The assessment") plus alignments, whose overlays join by `read_index` and cannot use the generic region reader.

## The mark translator's rules

In `r-export`'s `rexport/`: `rplot.ts` (plot model), `markToPlot.ts` (mark and channel stages), `transformR.ts`, `frameFor.ts`, `rScript.ts` (assembler).

- **The browser runs each region's transform steps alone.** An `aggregate` keys `.region` beside its groupby, and a `bin` on a shared axis aligns to genomic multiples of its width after removing the region's offset. An `auto` bin follows the figure's zoom through the display's `autoBinStep` ladder.
- **Facet steps run over each section alone**, `split` with `addNA` so a missing key is a section, not a dropped row. Every split rebinds through `bind_groups`, because `do.call(rbind, list())` is `NULL` and the browser draws an empty window as an empty panel. A facet over an empty window still dies, since `facet_wrap` refuses a frame with no rows.
- **`rows` draws as `facet_wrap`** in `domain` order and yields to a `facet` where both are set. A log axis cannot pin a bound at or below zero, so that end follows the data and the header says so.
- **A step or mark naming a column no stage produced is skipped and reported.** That check is a runtime one (`missingColumns`) and has to be: the step list is config, so `applyTransforms` can only answer `string[]` and `Aes<C>` widens to any string. The `NoInfer` check bites only where a frame's columns are literal.
- **Steps carrying a jexl callback** (`filter`, `formula`), structure a table does not hold (`flatten`, `mate`) and `rowColor` are reported in the header, not translated.
