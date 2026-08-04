---
name: screenshot-review-purple-markers
description: A screenshot-review backlog pass (29 bad to 12) plus the insertion-marker color change it produced, and the stray-marker-on-a-no-call-row bug that regenerating the figures uncovered. Read before picking up the review backlog or touching drawVariantInsertionGlyphs.
---

# Screenshot review pass + insertion marker color, 2026-08-04 (handoff)

Worked the `bad`-status backlog in `website/scripts/screenshot-review.json` from
29 entries down to 12. Two commits landed:

- **`77ba5314d5`** `docs(website): work the screenshot-review backlog, and give
  two figures a scale to read against` — 17 verdicts flipped, specs + docs +
  PNGs. (Written as `655b077da5`; another agent rebased it minutes later, which
  is routine in this worktree — find it by message, not by hash.)
- **`60136cdede`** `fix(variants): give multi-sample insertion markers the
  shared insertion purple` — code only. **Its figures are deliberately NOT
  committed**; see the open bug below.

Nothing is left uncommitted. The `pangenome_ecoli.md` prose written for the new
figure is parked at the end of this file instead — it names purple bars, so
committing it against the old PNG would have published a mismatch, and leaving
it dirty in a shared worktree invites another agent's `git add -A`.

The living process doc is still
`website/scripts/screenshot-review-plan.md` — regen commands, the build-vs-dev
render paths, `flip-review.ts`. This file is one pass's findings, not a
replacement for it.

## THE OPEN BUG: a marker on a row with no call

**`pangenome/maf` paints an insertion marker on NCTC86's row where the VCF has
no call.** This is pre-existing and was invisible until `60136cdede`: the marker
used to take its cell's own color, so a marker wrongly drawn on a no-call cell
was olive-on-olive against the no-call band.

Measured, at the `chr:4,579,961` column of
`https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb.vcf.gz`:

```
4579961  CFT073  ALT1  inserted=7833
4579961  IAI39   ALT1  inserted=7823
4579961  Sakai   ALT1  inserted=7817      NCTC86 = "." in every one
```

Checked per sample against the allele that sample carries (not `ALT[1]` blindly
— an earlier pass of this check missed multiallelic records and has to be
written as a per-GT-index lookup), over `chr:4,577,500-4,582,000`: every record
biallelic, NCTC86 carries no insertion allele anywhere in that window.

The render disagrees. Row bands in `static/img/pangenome/maf.png` are 60 image
px from y=656 (CFT073 656-716, IAI39 716-776, NCTC86 776-836, Sakai 836-896,
confirmed against the gutter label centres). At x≈1280-1360 **all four** bands
are purple. Sampling one pixel per band against `git show HEAD:` for the same
file: CFT073/IAI39/Sakai were `(38,89,115)` hom-alt before and are `(192,0,192)`
after; **NCTC86 was `(191,170,64)` no-call before and is `(192,0,192)` after.**

Three carriers, four markers.

**The gate is not the cause.** `getPhasedColor` returns `NO_CALL_COLOR` for a
`.` allele (`plugins/variants/src/shared/getPhasedColor.ts:88`), and
`computeVariantCells` sets `isAltCell = !isRefCell && c !== NO_CALL_COLOR`, so
`cellCarriesAlt` is 0 for those cells. The existing test `leaves reference and
no-call cells alone` passes. Note a haploid `.` takes the
`isPhasedOrHaploid` branch rather than the `isNoCall` one, since
`isPhasedOrHaploid` is `!genotype.includes('/')` — worth keeping in mind, but it
still lands on `NO_CALL_COLOR`.

**Untested lead: row indexing.** `drawVariantInsertionGlyphs` reads
`region.cellRowIndices[i]` off `model.insertionGlyphRegions`, while
`Canvas2DVariantRenderer.ts:53` reads the identical expression off the payload
it is handed. `placeVariantRows` permutes `cellRowIndices` from the worker's
canonical numbering into screen rows and returns a *new* payload. If the overlay
is handed the unplaced one and the cell renderer the placed one, markers sit on
canonical rows while cells sit on screen rows. That is exactly the hazard
`plugins/variants/src/CLAUDE.md` warns about ("The cell arrays stay in the
worker's row numbering… Placement writes a second array"). **Verify before
acting on it** — it was not confirmed, and it does not obviously explain four
bands from three markers.

Three figures are held (reverted, not committed) until this is settled, because
each would publish a claim the data does not support:

```
website/static/img/pangenome/maf.png
website/static/img/pangenome/hprc_graph_vs_callset.png
website/static/img/hprc2/mhc_clustered.png
```

They are the only three the change actually moves; see the sweep-hygiene note
below.

## Sweep hygiene: test the pixels, not the file list

`node scripts/generate-screenshots.ts --affected` selected 89 specs for the
variants change and rewrote 15. **Only 3 of the 15 had anything to do with it.**
The other 12 (`top_level_menus`, `protein/connected` at 48.85%, the
SV-inspector import forms, six `jbrowse-img` renders) were other agents' commits
already baked into the build — drift, not this change.

The discriminator is cheap and worth reusing: count pixels near the color the
change introduces, current file vs `git show HEAD:<path>`.

```python
purple = (((r-192)**2 + g**2 + (b-192)**2) < 900)   # INSERTION_COLOR #c000c0
```

Zero delta on twelve, tens of thousands on three. Revert the rest — sweeping
them in misattributes another agent's work to your commit, and the shared
worktree makes that easy to do by accident.

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

## Still open: 12 `bad` entries

`pangenome/maf` is blocked on the bug above. The rest, with what is actually
being asked:

| Entry | The ask |
| --- | --- |
| `pangenome/hprc_chm13_allele` | RepeatMasker lane reads as glitchy in collapsed layout, too zoomed in to judge repeat load against background |
| `pangenome/hprc_repeat_classes` | try a synteny view; shrink the multiwiggle |
| `pangenome/long_reads` | not interesting; try view-as-pairs / link supplementary, and a MAF or Bandage lane |
| `pangenome/rgfa_paa_bubble` | why is this not more of a rainbow palette |
| `pangenome/rgfa_strain_launch` | chaotic; unclear what path the LGV takes through the graph |
| `genomes_synteny/launch_sequence` | `showCurves` + transparent indels on the last frame; find a gene whose indels are clearly one transposon insertion |
| `cancer_sv/k562_starfusion_triage` | circular view is weak alone, make it multi-part |
| `hic/two_regions` | add a whole-genome overview |
| `hic/faint_contacts` | consider deleting |
| `pangenome_cactus/variants` | consider deleting |
| `orthofinder_synteny/wheat_4a` | are you happy with it; improvements invited |

Extract the live list rather than trusting this table:

```bash
jq -r '[to_entries[]|select(.value.status=="bad")]|.[]|"\(.value.name)\t\(.value.note)"' \
  website/scripts/screenshot-review.json
```

Write verdicts only through `node scripts/flip-review.ts good|answered|remove
<name> "<note>"` — never `jq`, never an editor. `remove` deletes the entry
outright; if you mean "this is settled", that is `good` or `answered`.

## Parked prose for `pangenome_ecoli.md`

Land this with the regenerated `pangenome/maf.png`, replacing the two sentences
that currently begin "Insertions have no reference span to sit on". It answers
the review note the figure was denied on ("still dont understand this figure and
the text like 5593… also it is not shown in the MAF display which means it is
inconsistent"). Re-check the third paragraph against the fixed render first —
the count of carrying strains is the thing the open bug is about.

```markdown
`samples` still names and labels the rows, so a tree that fails to build leaves
the track working.

The purple bars in the variant lane are insertion markers, and the number on one
is how many bases that strain's allele adds beyond K12. They need a marker
because an insertion consumes no reference: the record spans a single base, so
without one it would draw at the same width as a SNP whatever its length. Three
strains carry one at the same point here, of slightly different lengths, which
is three separate records rather than one.

Nothing in the alignment below them corresponds, and that is not an
inconsistency between the two lanes. A MAF projected onto K12 can only draw what
has K12 coordinates, and inserted sequence by definition has none; what the
alignment shows at such a point is the strains that do align there.

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity, and codon view, all derived from the alignment with no extra
files.
```
