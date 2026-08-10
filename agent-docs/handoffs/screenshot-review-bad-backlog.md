# Screenshot review: the `bad` backlog of 2026-08-10

The reviewer filed 27 `bad` verdicts on 2026-08-10. Sixteen are answered and
flipped; **ten are still open**, plus one that another agent resolved. This is
what was learned, and what each open one needs.

`website/scripts/screenshot-review-plan.md` is the pipeline doc — read that
first for mechanics. This file is only the state of this round.

## Two agents worked this backlog at once

`cnv1000g/ccl3l1_depth` was deleted on main by another agent
(`7492c59285`) while this branch was mid-flight, and the KIR figure was
reverted (`e55c101044`) by the same hand that this branch deleted it with. Both
resolved the same way, but **rebase before assuming an item is still open**, and
re-run the hash triage in the plan doc rather than trusting a stale list.

## Findings worth keeping, independent of any one figure

- **A spec can carry a correct callout and ship a figure without it.**
  `pangenome/rgfa_hover_sync` had the pill that answered its review note since
  the previous round, anchored `dy: +90` off a node the force layout puts at the
  foot of a 1250 px capture — so it painted at y≈1299 and no review ever saw it.
  `drawAnnotationOverlay` only reports an anchor that resolved to **nothing**; an
  anchor that resolves and then draws off-frame is silent. Worth a check in the
  overlay: an item whose drawn rect falls outside the viewport is almost always
  a bug.
- **An alignments lane that does not fit SCROLLS**, so neither the
  below-the-fold report nor the blank-space one can see it. Three pinned heights
  on `cancer_sv/k562_fusion_inspector_split` (260, 380, 480) each looked complete
  in the run's reports and each cut the pileup in half. The tell is a scrollbar
  thumb on the display's own right edge. `heightMode: 'grow'` plus sizing the
  frame off the report is the fix.
- **`LinearMultiRowFeatureDisplay`'s `partitionField` jexl throws through its own
  guard on `bigRmskBed`.** The slot documents
  `"jexl:split(split(feature.name,'#')[1],'/')[0]"` for this exact file type and
  it error-banners the whole display with `TypeError: Cannot read properties of
  undefined (reading 'split')`, escaping `makeFeaturePartitionResolver`'s
  per-feature `catch` — which exists so one unparseable name costs its own row
  rather than the track. Setting it as a config slot in the track's `displays`
  instead of on the view's tracks entry makes no difference. Two related notes:
  jexl's `+` is numeric, so a `feature.name + '#sentinel'` workaround yields NaN
  and every feature lands in one empty row; and the attribute form
  (`partitionField: 'name'`) works but gives one row per repeat NAME, which is
  the outcome the slot's own docs warn about. See
  `website/scripts/specs/methylation.ts` for the full write-up beside the lane.
- **UCSC GenArk hubs are keyed on RefSeq accessions**, which is what let the
  TAIR10 RepeatMasker bigBed drop straight into the Arabidopsis bisulfite config
  with no aliasing — its chroms *are* `NC_003070.9` and friends. Worth checking
  before hosting anything for a non-model assembly:
  `https://hgdownload.soe.ucsc.edu/hubs/GCF/000/001/735/GCF_000001735.3/bbi/`.
- **Don't take a repeat's identity from the Ensembl REST API.** It returned the
  right interval for the Arabidopsis element under the id `AT4TE22180` — a chr4
  id on chr1. TAIR10's own `TAIR10_Transposable_Elements.txt` calls it
  `AT1TE14315`. (It is also flaky, per the reviewer.)
- **MANE Select's symbol column is `geneSymbol`**, not `geneName2`
  (`bigBedInfo -as`). Filtering still wants the accession — CDKN2A has two MANE
  entries — but `labels: { name: "jexl:get(feature,'geneSymbol')" }` makes the
  glyph label itself, and that is a config slot, so it goes in the track's
  `displays`.

## Still open

Ordered roughly by how self-contained each is.

### `multisv_rhd_dosage` — needs a verdict, probably not a fix

A forced regen reproduces the committed PNG **byte for byte**, so the
`drawInter: false` / `drawLongRange: false` fix from the previous round is in the
image the reviewer re-flagged. The note asks again why the arcs are not over the
deletion. Next step is to read the current picture against that claim, not to
change settings blind.

### `ld/anopheles_2la` — "improve y-screen real estate"

1472 px: two 300 px LD panels plus 297 and 240 px karyotype lanes. A forced
regen reports no blank below the content, so nothing is slack. Each lane's
height has a recorded reason (the Cameroon lane is one pixel per mosquito; the
Gabon lane's 240 exists so its five heterozygotes are ~17 px rather than an
11 px sliver on the frame edge). Real saving means shortening an LD triangle,
which is the figure's subject — measure before trimming.

### `alignments/strand_split_coverage` — better example wanted

"make this screenshot on an example that has dramatic differences between
strandedness e.g. on viral sample". Needs a dataset with genuine strand
asymmetry; check what is already hosted before adding anything.

### `dog10k-fgf4-retrogene-synteny` — annotate and reorder

"add red text annotation in the grey area saying what the finding is, how the
figure was made, and what the three rows are… if needed, rearrange so top is
reference, and bottom two are the modified samples."

### `synteny_self_chry_palindromes` — explain, and make it multipart

"unclear what 'inversion on top of match' means. is this an alignment artifact?
truly an exact palindrome? if it is, add a red text box saying what this is.
make it a multipart figure including the dotplot as first part."

### `multiway_synteny/ecoli_launch_from_selection` — an app change

"can the dialog y-screen real estate be improved by potentially adding an
'advanced' dropdown?" This is the launch dialog's own layout, not a spec edit.

### The pangenome four

- `pangenome/hprc_inversion` — "if the graphgenomeview would help show this we
  can consider adding graph panel."
- `pangenome/hprc_chm13_allele` — a secondary figure showing the L1 density is
  higher; a repeat track on hg38 too; red labels naming hg38 (top) and
  T2T-CHM13-v2.0 (bottom). The height half of this note is already done and
  recorded in the entry.
- `pangenome/pggb_untangle_rows` — "we have the MAF+multiway synteny view of
  this exact same data in another tutorial… generally a stronger figure than
  just this standalone." Consolidation decision, not a rendering one.
- `pangenome/pggb_bubble_tier` — "might benefit to see bandage force directed
  graph view of bubbles. backbone just tends to not look good." Note that the
  standing colour-scheme rule (`website/scripts/screenshot-review-plan.md`) says
  a graph shown beside a linear view uses reference-position and one shown alone
  keeps stable-rank; a layout change here has to respect that.
