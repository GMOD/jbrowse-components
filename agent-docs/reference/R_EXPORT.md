---
name: r-export
description: The unlanded R/ggplot2 exporter — which branch holds what, the part main invalidated and the part it did not, the settled design decisions, the parity facts the R side has to hold, and the Rscript oracle. Read before restarting it.
audience: internal
kind: spec
---

# R script export

An LGV view exports as a self-contained `.R` that redraws it from source in
`rtracklayer` plus base `ggplot2`. Two branches implement it and neither
landed. This doc is what survives them, written so the next attempt reads it
instead of the branches.

## Where the code is

| branch | head | on origin | holds |
| --- | --- | --- | --- |
| `r-export4-rebase` | `db6e771092` (2026-08-27) | yes | the fidelity-first exporter: 53 R helpers, `exportR.ts`, nine per-display fragments, the equivalence oracles, a 19-figure gallery |
| `r-export-rewrite` | `ddbae50e74` (2026-08-26) | **no** | the idiomatic-first one: `FigureSpec`, `rplot.ts`, `emitR.ts`, `jb2export --out fig.R` |
| `R_export4`, `R_export4-pre-rebase` | — | yes | superseded by `r-export4-rebase` |

`r-export-rewrite` exists only in this checkout. Push it before deleting
anything, or `rplot.ts` goes with it.

## The seam main cut

Main moved through the exporter rather than around it, and it split cleanly.

| what | size | invalidated |
| --- | --- | --- |
| `rhelpers/*.R` — 53 helpers | 1,703 lines | no |
| `exportR.ts` — assembler, helper-dep closure | 524 lines | no |
| `rplot.ts` — the typed plot model | 261 lines | no |
| the equivalence and `Rscript` oracles | ~3,000 lines | mostly no |
| `exportRCode.ts`, one per display | ~2,100 lines | **yes** |

`read_bam.R`, `pileup_layout.R` and `cram_to_bam.R` are R-side and format-side,
so nothing done to the display models reached them. The nine `exportRCode.ts`
files each read one display model's getters, and two of those displays are
gone: `MultiLinearWiggleDisplay` folded into `LinearWiggleDisplay`
([ADR-157](../architecture-decision-records/adr-157-a-row-displays-arrangement-is-the-rows-config-object.md)),
`LinearMultiSampleVariantMatrixDisplay` into
`LinearMultiSampleVariantDisplay`, and the arc displays became a `link` mark
([ADR-163](../architecture-decision-records/adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md)).

So a rebase spends its whole conflict budget on the one file family a rewrite
deletes. Pull the other four rows across instead.

## Settled decisions

Reversing one of these means re-running the experiment that settled it.

- **No bespoke R package.** A `ggjbrowse` wrapper was built and rejected:
  wrapping the logic makes the emitted script a black box the reader cannot
  tweak with ordinary ggplot2 knowledge. Everything emits as small visible
  inline helpers.
- **Not pixel-perfect, and that is the design.** Idiomatic R showing the same
  data beats matching JBrowse's rasterization. Row packing is
  `IRanges::disjointBins`, colours approximate the canvas palette. The parity
  bar that does apply is the top tier only — numbers a user reads and semantic
  decisions — the same standard the Canvas2D backend gets
  ([SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) §"What actually has to agree").
- **No TS→R transpiler.** Considered and rejected: machine-generated R is
  non-idiomatic and fights hackability. The `rhelpers/*.R` →
  `rHelpers.generated.ts` step is not one — it bundles hand-written R verbatim
  so a browser bundle can carry it. Do not extend it into a translator.
- **A cumulative-bp axis, not `facet_grid`.** Multi-region exports concatenate
  regions left-to-right on one continuous axis, the way LGV lays them out
  internally. Facets are separate panels and cannot draw a geom *between* two
  of them, so cross-region read connectors exist only on one axis.
- **The script names what it left out.** A track no panel read, a setting with
  no R counterpart, an untranslatable jexl filter — each lands in a header
  comment rather than vanishing. A figure that quietly differs from the view it
  claims to redraw is the failure worth a header line.

## The typed plot model

`rplot.ts` models a ggplot and renders it, rather than pasting strings. Pasting
puts every mistake past the compiler and into the figure, where the script
exits 0 and the picture is quietly wrong. Three bugs are unrepresentable in it:

- **A second scale on one aesthetic.** ggplot keeps one scale per aesthetic and
  silently replaces the earlier one, so read bodies lost their colouring the
  moment mismatch ticks arrived. `scales` is keyed *by* aesthetic, so there is
  nowhere to put a second. This is
  [ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md)'s
  rule arriving independently from the R side.
- **A multi-statement read spliced into an assignment.** `x <- <block>` keeps
  only the block's first statement. A frame is a name plus statements, and the
  renderer decides the binding.
- **An `aes()` naming a column the read never produced.** R finds that at draw
  time, and only if that layer draws. `Aes<C>` finds it at `tsc` — but only
  with `NoInfer` on `layer()`'s `aes`, without which TypeScript infers `C` from
  the aes too and a typo widens the type to admit itself.

`xlim` is pinned per panel for a related reason: without it each panel takes
its range from its own data, so a read overlapping the right edge stretches the
pileup past the coverage above it and three panels drawn for one locus show
three different loci.

## The R helper library

One real `.R` file per helper, named for the helper it defines
(`read_bam.R` defines `read_bam`), regenerated into a `HELPERS` table by
`pnpm gen:rhelpers` with a `--check` mode in CI — the `.slang` → `pnpm
gen:shaders` convention. Real `.R` files mean no TS-template escaping
(`"\\.cram$"`, not `"\\\\.cram$"`), and the test R-`parse()`s every file and
`sys.source()`s the library to prove each defines exactly its own helper.

A fragment declares only the helpers **its own plot code** calls; `HELPER_DEPS`
plus `resolveHelpers` adds the transitive closure at assemble time, and a test
scans the R bodies and fails on a missing edge. The region helpers
(`region_layout`, `read_regions`, `region_scale`, `region_dividers`,
`region_xlim`, `region_ruler`, `region_title`) emit into every script.

A reader takes `(uri, chrom, start, end)` and returns a **genomic**-coordinate
frame. `read_regions` is the only place genomic → cumulative happens; it clips
each feature to its region and shifts the named coordinate columns. Line-like
geoms group by `.region` or a line connects across the gap.

## Parity facts

Each of these cost a wrong figure to find.

- **The `read_index` join is index-based.** Every alignment overlay emits
  `read_index`, the position in `readGAlignments` order, joined via
  `reads$row[x$read_index]`. **Never drop rows from `reads`** — it desyncs the
  join. `read_filter` marks a `keep` column instead and the layout leaves a
  filtered read at an NA row, which ggplot omits, so bodies and overlays vanish
  for free. Multi-region renumbers each region's `read_index` into the combined
  frame before concatenating.
- **Overlay rows outside a region are dropped, not clipped**, while a read's
  start and end *are* clipped, so a read straddling the edge draws cut at the
  boundary but a mismatch position outside the region simply is not drawn.
- **MD is optional in BAM, so mismatches take two paths** — the MD walk, and a
  sequence-layer projection against the reference for a read without the tag,
  the same split `BamAdapter` makes. An MD-only walk drew a pileup with no SNP
  ticks on an MD-less file and reported nothing. The reference is a FASTA *or* a
  2bit; a 2bit assembly used to resolve to none at all.
- **Rsamtools cannot read CRAM.** Each panel decodes the region to a temp BAM
  via samtools, which restores MD while decoding, so a CRAM never reaches the
  MD-less path. Given `-T`, samtools uses only that fasta, and a JBrowse
  assembly routinely pairs a no-prefix fasta with refname aliases — so
  `cram_to_bam` retries unaided with the ENA md5 service as `REF_PATH`. A
  published CRAM's own `UR` header is usually the producer's dead cluster path
  and modern htslib does not fall back on its own.
- **Insert-size colouring is median ± 3·1.4826·MAD** over primary proper pairs,
  JBrowse's robust estimator, not mean ± sd.
- **JBrowse paints one modification call per reference column** — the most
  likely over every MM group on the read, an earlier group holding a tie. A row
  per type drew twice at every cytosine of a combined `C+mh` code: 30,174 marks
  against the browser's 25,154 on `test_data/arabidopsis_methylation`.
- **Simplex is the whole game for modBAM denominators.** An ONT modBAM's MM
  groups are `C+m` with no `-` partner, so only the examined strand was
  basecalled, and dividing by every read carrying the base halves every bar.
  The detection runs over the whole dataset, so the R side pools the parsed
  `<sign><type>` pairs across regions. They ride as an *attribute*, not a
  column, because they have to survive the `min_prob` row filter — and any row
  subset drops attributes, so read it before subsetting.
- **The sort rules are subtle; mirror `sortLayout.ts`.**
  `sortByMapWithUnknownsLast` puts reads carrying the sorted-on feature first
  and reads without it last **for base and interbase but not for `tag`**, where
  a missing tag is `0`/`""` and sorts among the rest. Interbase keys on an exact
  column match, unlike the base sort's deletion *span* test. A tag sort goes
  numeric only when **every** value parses. Every branch returns an ascending
  numeric key with `Inf` meaning "no key", so a descending criterion keys
  negative rather than sorting separately.
- **rtracklayer returns 1-based inclusive coords.** Every reader converts to
  0-based half-open; the one that did not left a 1bp hole between adjacent
  BigWig bins that the device antialiased into scattered full-height white
  seams.
- **`ggsave()` refuses a dimension over 50 inches**, and figure height is the
  unbounded sum of panel weights, so a 2,504-sample cohort asked for 5,008
  inches and died at the script's last line after every read. Clamp it.
- **A one-row feature panel needs `expand_limits(y = 4)`.** A glyph is a fixed
  fraction of a row, so a 1-row panel's 0.7 y-range let the CDS rect fill it
  solid. No-op past 4 rows.
- **Labels decimate like `fitWidth`.** Centre-to-centre against combined
  half-widths, not "is the box wide enough" — long features stacked in one
  window have near-identical centres however wide each box is. 1,009 DGV
  records keep 215 labels.
- **`GRanges` has no `[[`**; read metadata columns via `mcols(g)[[nm]]`.

## Verification

Codegen string checks miss the bugs that matter. The technique that works runs
the *actual* generated script through `Rscript` against `test_data/volvox/*`,
asserts the figure exists, and then runs a second probe script that calls one
helper and asserts a known biological fact — the ctgA:1693 C-SNP, the `RG:Z:4`
200-read split in `volvox-rg.bam`.

Above that sit cross-implementation oracles that run the real JS and the R
helpers over identical data and assert read-for-read agreement: JBrowse's
`computeSortedLayout` against `sorted_pileup_layout`; both of the browser's
modification readings against `bam_modifications` over every modBAM in
`test_data`, including a samtools-rewritten copy whose `C+m.` group becomes
`C+m?`, the skip flag no fixture in the tree carries; `mod_coverage` against
`computeModificationCoverage`; `read_base_counts` against `Rsamtools::pileup()`.
Stripping MD from a BAM that has it and requiring the reference path to
reproduce what the MD path found is the mismatch oracle.

One layout difference is intended: `placeRect` leaves a 2bp gap between reads
sharing a row and the R helper packs on strict overlap, so equivalence fixtures
span the sort column to give every read its own row.

## What the grammar now supplies

The nine `exportRCode.ts` files exist because in July each display spelled its
mark, colour axis and value scale its own way, so the exporter learned nine
dialects. It no longer has to. A mark display's config is a ggplot spec in
another dialect:

| config | ggplot2 |
| --- | --- |
| `marks[].mark`, `linkShape` | `geom_*` |
| `marks[].encoding.{x,y,color,shape,size,text}` | `aes()` |
| a channel's `{scale, domain, range, scheme}` | `scale_<aes>_*` |
| `transform[]` — `bin`, `aggregate`, `coverage`, `pileup` | base R over the frame the layer reads |
| `facet` | `facet_wrap` |
| `scales.y` | `scale_y_*`, `coord_cartesian` |
| `rows`, `rowColor` | the row axis and its second colour scale |

The naming is Vega-Lite's by
[ADR-159](../architecture-decision-records/adr-159-a-mark-is-spelt-as-vega-lite-spells-one.md),
which is the same lineage ggplot2's is, so most rows are a rename.
[GRAMMAR_OF_GRAPHICS.md](GRAMMAR_OF_GRAPHICS.md) §"Where the tree answers each
stage" already cites `scale_colour_steps` and `scale_colour_identity` as what
`threshold` and `identity` are.

What stays hand-written per display is what a format-typed display holds that
is not a channel — layout, tiering and fetch shape
([SESSION_SPEC_FORMAT.md](SESSION_SPEC_FORMAT.md) §"The assessment") — plus
alignments, whose overlays join by `read_index` and cannot go through the
generic region reader.

## What is built

`plugins/marks/src/rexport/` translates the stages above for the mark display,
over BigWig, GFF3 and VCF. `rplot.ts` is the plot model, `markToPlot.ts` the
mark and channel stages, `transformR.ts` the transform stage, `frameFor.ts` the
data stage and `rScript.ts` the assembler. The helper library is
`rhelpers/*.R`, bundled by `pnpm gen:rhelpers` and gated by `pnpm autogen
--check`.

Four transform steps run as base R: `bin`, `aggregate`, `coverage` and
`pileup`, the last through `IRanges::disjointBins`, which is what makes a
`row` a real column rather than an assumption. `filter` and `formula` carry a
jexl callback and `flatten` and `mate` fan out structure a table does not hold,
so each is reported in the header instead.

A step's output columns flow into the next step and then into the layer's
`Aes<C>`, so a mark naming a column no stage produced fails `tsc`.
`rScriptRun.test.ts` runs the emitted scripts through `Rscript` against
`test_data/volvox`, and skips itself where R is absent.

## Open on the branch

- **Bisulfite.** Reference-dependent C→T has no MM tag to read, so it needs the
  reference sequence and its own walk.
- **Per-type modification filtering.** `shownModifications` /
  `hiddenModifications` are not applied; the header says so.
- **Phased-HP PS hue** flattens to the flat secondary colour instead of a
  per-phase-set hue.
- **Multi-wiggle pos/neg bicolor split**, and group/cluster tree order.
