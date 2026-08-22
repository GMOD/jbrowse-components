---
name: tutorial-tour-candidates
description: Fourteen tutorial pages whose route a figure cannot carry, ranked by the prose each tour would delete over the risk of filming it. Eleven are filmed and their entries record what each estimate got wrong; what is left is 5, 13 and 14. Read before writing a video spec for a tutorial.
audience: internal
---

# Tutorial tours worth filming

**Colin's standing preference: film the TUTORIALS before the user guides.** The
three tours filmed on 2026-08-21 were two user guides and a quickstart, which is
the wrong end of the corpus to have started at. `tutorial-tours-from-scratch.md`
holds the remaining user-guide proposals and the harness analysis; this file is
the tutorial half and is the one to work from.

Coverage: **20 of 43 tutorials carry a tour** — `allvsall_synteny`,
`analyze_trio`, `bxd_qtl`, `cancer_sv`, `chromhmm`, `dog10k_selection`,
`genomes_proteins` (3), `genomes_synteny`, `hg002_haplotypes`,
`hic_structural_variants`, `mcscan_synteny_grape_peach`, `methylation`,
`multiway_synteny_grape_peach_cacao`, `pangenome_ecoli` (3), `pangenome_hprc`
(2), `repeatmasker_classes`, `sv_multisamples`, `sv_visualization_cgiab`,
`synteny_visualization`, `tcga_cohort_cnv`, `tcga_cohort_mutations`. The other 23
do not.

**Eleven candidates are filmed and landed** on 2026-08-21 — 1 to 4, then 6, 7,
8, 9, 10, 11 and 12, one clip serving two pages for 3. Their entries stay below
with what each actually cost and what it corrected, because the next tour on
those pages starts from them. **What is left is 5, 13 and 14**, and 14 wants its page
restructured first.

Every candidate below came out of the ten-agent tutorial audit
(`tutorial-structure-audit.md` is that audit's structural half). Each names the
prose it makes unnecessary, which is what ranks it.

**A tour does not retire a figure.** Two were retired on 2026-08-21 and put back
the same day: Colin's call is that the stills and the clips both stay, so
"deletes a figure" is not a point in a candidate's favour and not a step in
filming one. What a clip can shorten is PROSE — a paragraph of sequential clicks,
a section that only introduces the next state. `video-specs.ts` states the reason
in its own header: a figure is searchable, diffable, annotatable and readable at a
glance, and none of that survives being filmed.

## The four that were first, all done

**1. `variants/trio_phased_matrix` — `tutorials/analyze_trio.md`**

`Display types → Multi-sample variant display (matrix)`, then
`Rendering mode → Phased`, ending on the six haplotype rows.

The highest value/risk ratio in the corpus. The page spends **three `##`
sections and four figures** on one two-click route — `trio-basic`,
`trio-matrix`, `trio-matrix-phased`, `trio-matrix-phased-clean` — each a result
staged as its own cause. One clip retires three of the four and the two sections
that introduce them.

**Filmed.** `videos/variants.ts`, 620px frame, 38s. What the estimate got wrong:

- **It retires none of the four.** Two were dropped and restored the same day;
  see the rule above. All four stills stay, the clip sits under the phased one,
  and the three sections stay as they were.
- **It could not open at the figures' locus.** The default display gates at one
  feature per pixel and this VCF carries every 1000 Genomes site, so 2.9 Mb of it
  draws "Too many features" and the first take filmed that banner. The tour opens
  at 20 kb and types the wide window at the END, which also puts the reason the
  matrix display exists into the clip.
- The two sections that introduced the retired figures are now one.

**2. `synteny/hg002_dotplot_import` — `tutorials/hg002_haplotypes.md`**

`Add → Dotplot view` → the import form → `Manual` → both axes → **Plot only
certain chromosomes** → wildcards → `Launch` → the palette button's `Strand`.

A route through a form that **changes shape as you use it**: a mode toggle, a
checkbox that grows two text boxes, wildcard entry, then a coloring change. The
page walks it in three paragraphs of sequential clicks.

It also fixes a live defect by construction. The audit found the page describes
the **Manual** panel and then tells the reader to switch to Manual — but the
form opens on **Quick start**, because the session holds a launchable
self-alignment track (`useQuickStartState.ts:65`, and `syntenyTrackRows.ts:14-18`
on why a self-alignment qualifies). Filming it makes that impossible to
reintroduce.

**Filmed.** `videos/synteny.ts`, 768px frame (sized to the launched plot, not the
form), 46s. Quick start confirmed at the source: `quickStartSyntenyTracks` keeps
the Q100 chain because `syntenyTrackRows` gives it two present rows, so `Manual`
is a real click — and Quick start's own launch passes an empty filter to both
axes, which is every contig of both haplotypes interleaved.

**The `:96-98` defect went the other way** and is fixed in prose rather than by
filming: the linear synteny form also opens on Quick start, where
`applyQuickStartSelections` has already put the chain's two rows in, so the
page's "pick the assembly in both rows" was describing a panel the reader never
lands on. `Launch` is the only click there.

**3. `sv/derivative_allele_route` — two pages at once**

`Track menu → Launch view → Reconstruct derivative allele...` → pick a route →
`Draw as → Breakpoint split view` → `Replace current view`, ending on one panel
per segment.

A route **and** a re-layout. It serves `tutorials/cancer_sv.md:133-146` and
`tutorials/sv_visualization_cgiab.md:640-649`, and `sv/inspector_route` stops at
the SV inspector's table filter, so nothing overlaps.

**Filmed.** `videos/sv.ts`, 1340px frame, 34s, on COLO829's four-segment chain —
the only route that makes the page's point, since it leaves chr3 and returns to
it inverted and so draws two chr3 panels where a hand-filled form gets one. The
figure of the end state (`cancer_sv/multihop_split_view`) now reads the same
session as the tour, so their per-panel track heights cannot drift.

**The `FLOW_NUMBER` claim in the original entry is wrong.** Its three call sites
are all inside `cancer_sv/split_view_from_breakend`, which is the sibling
right-click route on a BND record (`cancer_sv.md:148-164`), not this one. Filming
this retires nothing of that machinery; retiring it needs a tour of THAT route or
a decision to drop that composite.

**4. `repeats/painting_display_switch` — `tutorials/repeatmasker_classes.md`**

`Display types → Multi-row feature display (painting)` on the RepeatMasker track.

The cheapest clip of the four and the archetypal re-layout. The page states it
with two stacked stills and a caption asserting "the same track and the same
fetch", which is exactly the claim two pictures cannot make. Hosted BED, one
menu path, no pileup.

**Filmed.** `videos/repeats.ts`, 520px frame, 35s, and it is TWO menu picks
rather than one: `Display types` leaves `partitionField` at `name`, which on
RepeatMasker is one row per repeat, so the class lanes are
`Partition by... → repClass` after it. The page never mentioned the second pick,
so a reader following it landed on the hairlines — that sentence is now on the
page, and the `Partition by...` submenu's own list of the file's columns is the
clip's payoff frame.

One thing the session had to carry: `replaceDisplay` builds the new display from
its own config rather than carrying the old one's height, so the tour's session
pins a `displays` array (packed first, multi-row second with a height) — which is
the shape this page's config section prints anyway.

`multirow/display_types_menu` stays on the page beside the clip, as does the
comparison figure.

## The rest, ranked

5. **`epigenomics/bisulfite_contexts`** (`bisulfite.md`) — `Color by... →
   Bisulfite / EM-seq` cycling **CpG → CHG → CHH** on one pileup, over
   `NC_003070.9:4,398,000-4,412,000`, the gene body dropping out while the LTR
   element stays red. Deletes a **three-panel stacked figure** that exists only
   to make a comparison one track can make by itself. Risk: it is a pileup, and
   `website/CLAUDE.md` warns those block the main thread under swiftshader — try
   `--headed` first.
6. **`sv/multisample_sort`** (`sv_multisamples.md`) — **FILMED**, 1236px frame,
   34s. The page's only figure of that track is ALREADY sorted, by clicking, in
   its own `actions` — so the order a reader lands in appears nowhere, and
   neither does the dendrogram. The right-click is anchored by locus, since
   `sortByGenotype` takes the id of the variant under the pointer and a
   right-click between records offers a menu with no sort item in it. The sort
   stays on camera (synchronous over loaded cell data); only the clustering RPC
   is cut.
7. **`hic/two_regions`** (`hic_structural_variants.md`) — **FILMED**, 1124px
   frame, 21s. Types the FIGURE's own two-region locstring rather than the one
   this entry proposed, which appears nowhere in the tree: the tour ends on the
   state `hic/bcr_abl1_translocation` is of, and opens on that string's first
   region. Two things a wide frame did to it: the Enter keypress alone filmed
   11.3s of frozen app while it re-laid out and kicked both fetches off (`cut`
   goes on the PRESS here, not on the wait after it), and the bottom matrix ran
   12px past the figure's 1100. The scan two sections down is still not filmed;
   it prints a ranking, and a page can print text.
8. **`synteny/allvsall_launch_from_selection`** (`allvsall_synteny.md`) —
   **FILMED**, 640px frame (sized to the dialog), 33s, reusing every helper
   candidate 9 added. The reorder is THREE clicks on three different buttons:
   `MoveButton` carries the panel's position in its own aria-label, so each click
   renames the control the next one is made on — which is why a still cannot show
   this dialog being used. Five rows put it over `BULK_SELECT_THRESHOLD`, so it
   also grows a Select all/none row. The clip's last frame is a different row
   order from the composite's third still, deliberately: that is what makes the
   page's "IAI39 sits directly below K-12" checkable.
9. **`synteny/restack_around_locus`** (`multiway_synteny_grape_peach_cacao.md`)
   — **FILMED**, 640px frame (sized to the dialog), 28s. The section said to
   drag "any row's scale bar", which is false in the state its own figure shows:
   a `LinearSyntenyView` keeps the synteny track on the level between two rows,
   so `launchableTracks` finds nothing on a row and no Launch submenu appears at
   all. The tour opens on the plain LGV the section's second paragraph
   describes, and the prose now says where the offer lives. The dialog's own
   "also align here … no panel" line for the four undeclared assemblies is in
   frame, which is the lane-versus-panel distinction the page makes in prose.
10. **`synteny/liftover_launch`** (`genomes_synteny.md`) — **FILMED**, 540px
    frame, 31s, on hg38 vs hs1 at _TNNT3_ rather than on the composite's
    panTro6/_FTO_ pair. **The detour was not deleted, it was MOVED**: the
    four-panel composite is now the first figure of "Trying other pairs", which
    is the section claiming the click-path works on any liftOver track and had
    no picture, and the L1HS and panTro6-hub paragraphs went with it. The clip
    lands on the window `synteny_hg38_hs1_tnnt3` is of, so the ribbon-settings
    section has a ribbon to change and the rearrangement has something to read.
    Two things the entry did not know: the dialog is NOT the frame's constraint
    here (two checkboxes and a number field, against the region launch's panel
    list), and the block under the cursor is the whole-chromosome hg38→hs1
    chain — so unticking the CIGAR box opens both panels on all of chr11, which
    is now the sentence after the checkbox is named. Hovered rather than
    toggled: unticking it films a launch nobody wants.
11. **`synteny/dotplot_reorder`** (`mcscan_synteny_grape_peach.md`) —
    **FILMED**, 768px frame, 28s rather than the five seconds this entry
    estimated: it is a menu item that opens a dialog and does nothing until a
    second click, and the dialog counts what it moved and what it reversed.
    Needed one source change — the dotplot header's ⋮ button had neither a
    label nor a testid, so it has `dotplot_view_menu` now. The figure's session
    could not be reused: it carries `autoDiagonalize`, which runs as the view
    opens, before a camera would be on.
12. **`epigenomics/chromhmm_cluster`** (`chromhmm.md`) — **FILMED**, 890px
    frame, 21s. The figure's session sets `runClustering: true`, an init flag the
    autorun fires as the display first reports ready, so it could not be the
    tour's session — same shape as the dotplot's `autoDiagonalize`. Unclustered
    is not unordered here: `config_demo.json` pins a 127-line `rowOrder` in
    Roadmap tissue order, so the opening frame is a clean tissue stripe over a
    painting with no block in it and the run trades one for the other. On camera
    throughout: the run names its own phases over a determinate bar, which is
    the page's evidence rather than a spinner.
13. **`pangenome/tier_to_fine`** (`pangenome_ecoli.md`) — the coarse-to-fine
    ladder: find the arrowed IS5 bubble on the tier lane, then open the same span
    through the fine index. The page states it as prose it cannot show and spends
    two figures on the two ends without the move between them.
14. **`rnaseq/group_by_strand`** (`rnaseq.md`) — `Group by... → First-of-pair
    strand` on the MHC class III window. **Do the page's restructuring first**
    (`tutorial-structure-audit.md`): filming a page whose sections are
    reorderable just films the confusion. Note the audit also found the current
    instruction contradicts the figure it introduces.

## Traps, in the order they bit

All six cost a take or a debug cycle on 2026-08-21.

- **Rebuild `@jbrowse/web` before any run.** The generator serves the BUILD's
  assets, so a component edit made after the build is invisible and the failure
  is a missing selector.
- **`clear: true` used to select one LINE**, so a multiline field kept every
  other line and took the new value into the middle of them. Fixed in
  `website/scripts/actions.ts`, which calls `select()` now. The tell was a clip
  that filmed a disabled button being clicked and reported success.
- **Size a dialog-centred tour to the DIALOG.** The run's content report
  measures app height only, so it will tell you to shrink a frame the dialog
  needs. Pull a mid-clip frame with `ffmpeg -ss` and look.
- **`cut: true` on a `type` step** is how a paste is filmed. Five URLs typed a
  keystroke at a time read as 9.4s of nothing happening.
- **A re-frame needs `pnpm autogen`**, or the page reserves a box the wrong
  shape. Two generators always refuse in a worktree (jbrowse-img, social card);
  that is main's staleness, not yours.
- **`pnpm figures:push --filter <name>`**, never bare, then commit `media.lock`.
  A figure store with nothing on disk is skipped rather than emptied, which is
  what makes a media-only push safe from a worktree that never pulled figures.

## What is still missing from the harness

In `tutorial-tours-from-scratch.md`, which is where the numbered gaps live. The
two that reach this list: **a typed URL is paired with no page**, so a rehost
moves the film and the prose apart silently (six proposals type one), and
**`scrollTo` cannot scroll a drawer**, which caps how tall a drawer-subject tour
can be.
