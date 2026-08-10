# Screenshot review: the `bad` backlog of 2026-08-10

The reviewer filed 27 `bad` verdicts on 2026-08-10. All 27 are now answered:
sixteen in the first pass, ten in the second, one resolved by another agent.
**Nothing in this round is open** — this file is kept only until the verdicts
are re-reviewed, and should be deleted then.

`website/scripts/screenshot-review-plan.md` is the pipeline doc — read that
first for mechanics. This file is only the state of this round.

## The verdict flips are NOT in the branch, on purpose

`screenshot-review.json` is rewritten wholesale under a lock the review server
holds, and a worktree copy does not share that lock — so a branch carrying the
file also makes the ff-only landing refuse against a reviewer's dirty copy. The
second pass therefore accumulated its flips as `flip-review.ts` calls and ran
them from the primary checkout after landing. Do the same: work the figures in
a worktree, run the flips where the server runs.

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
- **A lane can be full and still be the wrong size, in either direction, and
  only geometry says which.** Two of the second pass's ten turned on this and
  the run's own reports could not see either. An unsquashed LD panel draws at
  natural aspect — apex depth is half the drawn width — so `ld/anopheles_2la`'s
  2La block needed 327 px and had 300, and the block the figure exists to show
  was cut flat at the lane boundary while the lane read as completely full.
  Conversely its karyotype lanes were sized off their row COUNT (297 px for 297
  mosquitoes) when the rows are grouped, so what the lane is read for is three
  contiguous bands and 140 px draws them 77/32/31 px deep. Compute what the
  content's shape demands before believing a lane that looks packed.
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
- **"Make this figure on better data" is often a claim the data cannot make, and
  the check is a count.** Three of the second pass's ten were this shape and two
  of them ended in a measurement rather than a new dataset. `multisv_rhd_dosage`
  wanted arcs over a deletion that produces **one** spanning read pair in its
  homozygous carrier, because it is NAHR between long identical repeats;
  `alignments/strand_split_coverage` wanted dramatic strandedness that was
  already in the frame at one column, 0.00 mismatch on 12 forward reads against
  1.00 on 10 reverse. Both now ship a script in `website/scripts/` that prints
  the numbers, which is what makes the answer re-checkable rather than an
  assertion. Count before hunting for data, and again before deleting a figure.

## Answered in the second pass

Ten items, with what each turned into. Every one carries its reasoning in the
spec it touched; this is the index, not the record.

- **`multisv_rhd_dosage`** — arc band removed
  (`scripts/count_rhd_mate_pairs.py`). The RHD deletion has no read-pair signal:
  NAHR between the ~9 kb Rhesus boxes means a junction-spanning fragment aligns
  collinearly. The band was drawing RHD↔RHCE paralogy instead, busiest in the
  0/0 control. Coverage lane keeps the 110 px.
- **`dog10k-fgf4-retrogene-synteny`** — one pill in the grey, three paragraphs
  for the note's three questions. The reorder is not available: both PAFs are a
  retrocopy against the PARENT and there is no CFA18-vs-CFA12 alignment.
- **`ld/anopheles_2la`** — 1472 → 1355, and the 2La block's apex now closes.
  See the geometry bullet above.
- **`synteny_self_chry_palindromes`** — now a compose, the boxed 4.8 Mb
  replotted at the ribbons' own 100 kb minimum as the first part. The pill
  answers "artifact?" (no) and "exact?" (near — the unpainted gaps in the
  magenta are where the arms differ).
- **`alignments/strand_split_coverage`** — the one-sided column boxed
  (`scripts/rank_strand_asymmetry.py`). The reviewer's viral example is a claim
  about depth, which `rnaseq/strand_split_coverage` already draws; ONT WGS is
  strand-balanced by construction.
- **`multiway_synteny/ecoli_launch_from_selection`** — an app change.
  `AdvancedLaunchOptions` in `plugins/linear-comparative-view` folds the region
  launch dialog's four defaulted fields under a disclosure; the panel list above
  them is what the dialog is for. The pairwise dialog deliberately does not get
  one. Watch the theme: `MuiAccordionSummary` is painted `palette.tertiary.main`
  app-wide, so the expand chevron needs the `contrastText` override
  `AboutWidget` carries or the header ships with no affordance on it.
- **`pangenome/pggb_bubble_tier`** — force layout tried, rendered, and worse
  (413 css px below the fold, the callout off-frame, the chain drawn as a line).
  Measurement recorded in the spec.
- **`pangenome/hprc_inversion`** — a graph panel is blocked on the
  reverse-complement edge-endpoint bug, which is *all* an inversion panel would
  draw. Add one once that lands; the fix is scoped under "Open plugin work".
- **`pangenome/pggb_untangle_rows`** — kept. A multiway synteny view draws
  ribbons only between neighbouring panels, so the four-strain comparison has to
  be assembled from four bands; this puts all four on one reference axis and is
  the only figure reading the untangle PAF's strand column.
- **`pangenome/hprc_chm13_allele`** — all three sub-asks answered, two by
  declining with a measurement (the two-lane repeat comparison is a bp/px
  difference before it is a repeat difference; the fourth pane is empty because
  CHM13 entered at rank 61). The red labels are in-app `displayName`s.

## Open plugin work this round identified

Nothing new, but one existing item is now load-bearing for a figure: the
reverse-complement edge endpoints (`screenshot-review-plan.md`, "Open plugin
work"). `pangenome/hprc_inversion` is the figure waiting on it.
