---
name: screenshot-review-purple-markers
description: A screenshot-review backlog pass and the two insertion-marker bugs it produced, both now fixed and their figures landed. Read before picking up the review backlog or touching drawVariantInsertionGlyphs.
---

# Screenshot review pass + insertion markers, 2026-08-04 (handoff)

Worked the `bad`-status backlog in `website/scripts/screenshot-review.json`. Six
commits landed; **find them by message, not by hash** — agents rebase each other
in this worktree routinely, and one of these hashes was already rewritten once.

- `docs(website): work the screenshot-review backlog, and give two figures a
  scale to read against` — 17 verdicts flipped, specs + docs + PNGs.
- `fix(variants): give multi-sample insertion markers the shared insertion
  purple` — the marker stopped taking its cell's genotype color.
- `fix(variants): stop calling every no-call cell alt-carrying in dosage mode` —
  the marker-on-a-no-call-row bug (below).
- `fix(variants): paint insertion markers the theme's insertion color, as the
  pileup does` — the color the first fix picked was the wrong one.
- `docs(website): regenerate the three figures the insertion-marker fixes move`
- `docs(pangenome): say what the numbered boxes are, and why the MAF lane is
  quiet`

Nothing is left uncommitted.

The living process doc is still
`website/scripts/screenshot-review-plan.md` — regen commands, the build-vs-dev
render paths, `flip-review.ts`. This file is one pass's findings, not a
replacement for it.

## The two insertion-marker bugs, both closed

**A marker on a row with no call.** `pangenome/maf` painted an insertion marker
on NCTC86's row at `chr:4,579,961`, where three strains carry the insertion and
NCTC86 is `.`. Pre-existing, and invisible until the marker went purple: it used
to take its cell's own color, so one wrongly drawn on a no-call cell was
olive-on-olive.

The cause was **not** the row-indexing hazard the first pass suspected. The
overlay and the canvas both read `model.perRegionCellMap`, the same *placed*
payload, so they cannot disagree about rows — that lead is dead, don't re-derive
it. It was `cellCarriesAlt`, computed as
`isAlt = !isRef && color !== NO_CALL_COLOR`. That test holds only for
`getPhasedColor`, which returns the `NO_CALL_COLOR` / `REFERENCE_COLOR`
constants by identity. `getAlleleColor` — allele-count mode, the default, and
what this figure uses — blends its no-call shade by dosage through colord and
returns a hex, so `.` came back `#bfaa40` and **every no-call cell in the
default coloring mode was flagged alt-carrying**. `genotypeCarriesAlt` (a
digit-1-to-9 scan, the mirror of `isNoCall`) answers it from the genotype now.

**Durable rule: never derive a cell fact from a resolved color string.** The
phased path gets away with it because its color function returns the constants;
nothing else does. `styleFromColor`'s doc says so now.

**The wrong purple.** The first fix used `INSERTION_COLOR` from alignments-core
and its commit message called it "the same purple the pileup uses". It is not.
`INSERTION_COLOR` (#c000c0) is the theme-agnostic fallback in
`DEFAULT_CIGAR_OP_DRAW_COLORS`, for worker code with no theme to read; the
pileup on the main thread paints `palette.insertion` (#800080, via
`alignmentComponentUtils` and `drawAlignmentLabels`), and so does plugin-maf's
`drawMafInsertions`. This very figure was drawing the same event in two purples.
`drawVariantInsertionGlyphs` takes the color as an argument now — the overlay
from `usePalette()`, the SVG export from the export theme.

**Still out of step: plugin-canvas' `drawMultiRowIndelGlyphs`**, which hardcodes
`INSERTION_COLOR` through the same two main-thread call sites (overlay +
`renderSvg`) and could take the palette exactly the way the variants one now
does. Left alone only because another agent had five files open in that
directory at the time.

## The MAF lane showing no insertion is the data, not a bug

The review asked why the marker has no counterpart in the MAF lane below it. The
obvious answer — "a MAF projected onto a reference can't represent inserted
sequence" — is wrong, and the codebase disproves it: `computeVisibleInsertions`
walks reference-gap columns and draws the same marker.

Measured on `ecoli_pggb.maf.bed.gz` (`tabix` + splitting field 6 on `,`; each
row is `name:start:len:strand:srcSize:seq`): the three strains stop aligning to
K12 at exactly `4,579,961` — `block4717` carries **only** the K12 row — so their
inserted sequence falls between alignment blocks rather than as gap columns
inside one. The nearest real ref gap, in `block4715`, is 72 bp, which is 1.2 px
at 60 kb. The blank MAF rows and the variant lane's markers are the same event
said two ways. This is now in `pangenome_ecoli.md` next to the figure. (Related:
`reference-maf-block-edge-gaps-not-deletions`.)

## Sweep hygiene: test the pixels, not the file list

`--affected` selected 89 specs for the first variants change and rewrote 15, of
which **3** had anything to do with it. Narrowing to "every spec whose session
carries a `LinearMultiSampleVariantDisplay`" still rewrote 14, of which the same
3 were real. Get that list by importing the specs rather than grepping:

```bash
node --input-type=module -e "
const { specs } = await import('./scripts/screenshot-specs.ts')
for (const s of specs) {
  if (JSON.stringify(s).includes('LinearMultiSampleVariantDisplay')) console.log(s.name)
}"
```

Then discriminate on pixels: count pixels near the color the change introduces,
current file vs `git show HEAD:<path>`.

```python
ins = ((r - 128) ** 2 + g * g + (b - 128) ** 2) < 900   # palette.insertion #800080
```

Zero delta on eleven, thousands on three. Revert the rest — sweeping them in
misattributes another agent's work to your commit, and the shared worktree makes
that easy to do by accident.

`screenshot-review.json` is the one file that **cannot** be split this way: it is
rewritten wholesale under one lock, so whoever commits it carries every verdict
written in that window, including the human reviewer's live ones. Say so in the
commit message rather than pretending they are yours.

Also worth knowing: a *phased* display is unaffected by the no-call bug, and
`renderingMode` is often auto-detected (`detectPhased`) rather than set in the
spec — so a static grep for `'phased'` over the specs will mislabel figures like
`hprc2/mhc_clustered`. The pixel test is the oracle, not the spec text.

## Done, and the reasoning worth keeping

**Three figures were denied for the same thing: no baseline in the frame.**

- `sv_cgiab/driver_cdkn2a_deletion` — the benchmark's `total_copy_number` **is**
  absolute, so CN 2 is diploid, but a 60 kb window around this deletion holds
  only CN 1 and CN 0 and nothing in it said what zero was. Now a compose, with a
  1.3 Mb frame above: the narrowest window carrying all three states, taken from
  the benchmark BED rather than chosen (CN 1, CN 0 across the deletion, CN 1,
  then CN 2 at `chr9:22,631,434-22,939,870`). The CN 1 flanks are real — the
  whole of 9p has lost a copy in this tumour.
- `methylation/arabidopsis_wgbs_two_color` — gained the MethylDackel CpG lane.
  Only the CpG subadapter of the config's three-context track, declared as its
  own `QuantitativeTrack`, since both pileups are colored by CpG.
- `tcga/mutations_cdh1_histology` — ClinVar lane dropped (collapsed over 16
  exons it is a 1500 px barcode with no column a matrix column can be lined up
  against) and both bands named in place, anchored by `fracY` of the display.
  Measured off the render: lobular is the last seventh of the rows and carries
  78% of the marks against ductal's 14% over 72% of them.

**`multisv`/`multisv_svtype` are back on chr19.** The RHD version moved to
`multisv_rhd_genotype` + `multisv_rhd_svtype`, composed as `multisv_rhd`.
`multivariant_track.md`'s caption already said "on chr19" and had never been
updated when the spec moved to chr1, so figure and caption agree again.

**The cancer_sv derivative specs were broken and nobody knew.** They clicked
`Draw it`; the dialog gained `Replace current view` in `c67f40f600` and renamed
its submit to `Draw in new view`, so the next regen would have failed either
way. They now click `Replace current view`, and the result frame is the synteny
view alone instead of 240 px of the same pileup above it. **A menu label is a
published API for the specs** — grep `scripts/specs/*.ts` before renaming one.

`ld/lct_lactase` left `ld_human.md` (its tutorial thumb had to move with it — a
card has to come from a figure its page embeds). `qtl/bxd_painting_clustered`
deleted. `ld/anopheles_r2_vs_dprime` defended and marked `answered`.

## Durable gotchas found this pass

**Two `LinearMultiSampleVariantDisplay`s in one view kill the right-click
context menu on both.** Same callset, distinct trackIds, the
`variants/potato_missingness` pattern. The right-click reaches the canvas (the
hover crosshair draws) but no menu opens, so a spec gated on
`waitForText: 'Sort by genotype'` times out against a fully-rendered matrix.
`useVariantCanvasInteraction`'s `onContextMenu` resolves its own feature and
opens nothing when that is undefined. One lane alone works every time. Measured
on both lanes, with and without a settling `hover` first. Not fixed — the
workaround is a capture per colouring and `mode: 'compose'`.

**That sort right-click is flaky even with one lane.** `multisv_rhd_genotype`
succeeded at `height: 400` / `y: 450`, then failed at `height: 340` / `y: 400`
on a spec that is otherwise identical. If a sort spec fails, re-run before
re-designing it.

**A `compose` has no annotation layer.** `ComposeSpec` extends
`BaseSpecFields`, which carries no `annotations`, and the parts are separate
captures `+append`ed afterwards — so nothing can draw across the seam. An arrow
from one half to the other is not available; number the two halves' anchors
instead (`pangenome/hprc_mhc_anchored` does this with `circle` badges).

**The anchored graph pane's aspect ratio is pinned** (row spacing is a fraction
of the reference span), so it is two rows tall whatever `viewportHeight` says.
Growing the viewport only adds page under it, and a three-line text pill
anchored below a node falls through the pane's border into the composite's
padding. Put long callouts on the force half.

**A callout anchored to a node can land under another callout.** The MHC pair's
two landmarks are an allele and the reference stretch it replaces, so the force
layout draws them touching and the pane's own caption sat on top of the second
ring. Render and look before believing an offset.

## Still open

13 `bad` entries as of this writing, but the reviewer writes new ones while you
work — **extract the live list, don't trust this table**:

```bash
jq -r '[to_entries[]|select(.value.status=="bad")]|.[]|"\(.value.name)\t\(.value.note)"' \
  website/scripts/screenshot-review.json
```

| Entry | The ask |
| --- | --- |
| `pangenome/hprc_chm13_allele` | RepeatMasker lane reads as glitchy in collapsed layout, too zoomed in to judge repeat load against background |
| `pangenome/hprc_repeat_classes` | try a synteny view; shrink the multiwiggle |
| `pangenome/long_reads` | not interesting; try view-as-pairs / link supplementary, and a MAF or Bandage lane |
| `pangenome/rgfa_paa_bubble` | why is this not more of a rainbow palette |
| `pangenome/rgfa_strain_launch` | chaotic; unclear what path the LGV takes through the graph |
| `genomes_synteny/launch_sequence` | `showCurves` + transparent indels on the last frame; find a gene whose indels are clearly one transposon insertion |
| `cancer_sv/k562_starfusion_triage` | circular view is weak alone, make it multi-part |
| `cancer_sv/derivative_autogenerated` | can it load reads across the derived regions, or run minimap2 in wasm against the derived contig; floated as an external plugin idea, not a request |
| `dog10k-igf1-haplotype` | improvements invited; what complementary tracks would tell a better story |
| `hic/two_regions` | add a whole-genome overview |
| `hic/faint_contacts` | consider deleting |
| `pangenome_cactus/variants` | consider deleting |
| `orthofinder_synteny/wheat_4a` | are you happy with it; improvements invited |

Write verdicts only through `node scripts/flip-review.ts good|answered|remove
<name> "<note>"` — never `jq`, never an editor. `remove` deletes the entry
outright; if you mean "this is settled", that is `good` or `answered`.
