---
name: tutorial-tour-candidates
description: Fourteen tutorial pages whose route a figure cannot carry, ranked by the prose each tour would delete over the risk of filming it. The top four are filmed and their entries record what the estimate got wrong; work down from five. Read before writing a video spec for a tutorial.
audience: internal
---

# Tutorial tours worth filming

**Colin's standing preference: film the TUTORIALS before the user guides.** The
three tours filmed on 2026-08-21 were two user guides and a quickstart, which is
the wrong end of the corpus to have started at. `tutorial-tours-from-scratch.md`
holds the remaining user-guide proposals and the harness analysis; this file is
the tutorial half and is the one to work from.

Coverage: **13 of 43 tutorials carry a tour** — `analyze_trio`, `bxd_qtl`,
`cancer_sv`, `dog10k_selection`, `genomes_proteins` (3), `hg002_haplotypes`,
`methylation`, `pangenome_ecoli` (3), `pangenome_hprc` (2),
`repeatmasker_classes`, `sv_visualization_cgiab`, `synteny_visualization`,
`tcga_cohort_cnv`, `tcga_cohort_mutations`. The other 30 do not.

**Candidates 1 to 4 are filmed and landed** on 2026-08-21, one clip serving two
pages for 3. Their entries stay below with what each actually cost and what it
corrected, because the next tour on those pages starts from them. Work down from
5.

Every candidate below came out of the ten-agent tutorial audit
(`tutorial-structure-audit.md` is that audit's structural half). Each names what
the page could delete, because a tour that only adds is the weaker kind.

## The four that are done

**1. `variants/trio_phased_matrix` — `tutorials/analyze_trio.md`**

`Display types → Multi-sample variant display (matrix)`, then
`Rendering mode → Phased`, ending on the six haplotype rows.

The highest value/risk ratio in the corpus. The page spends **three `##`
sections and four figures** on one two-click route — `trio-basic`,
`trio-matrix`, `trio-matrix-phased`, `trio-matrix-phased-clean` — each a result
staged as its own cause. One clip retires three of the four and the two sections
that introduce them.

**Filmed.** `videos/variants.ts`, 620px frame, 38s. What the estimate got wrong:

- **It retires TWO of the four, not three.** `trio-matrix` and
  `trio-matrix-phased` go, since each was a menu cascade pasted over its own
  result. `trio-basic` is where a reader opening the VCF stands, and
  `trio-matrix-phased-clean` is the crop source for both the gallery tile
  (`src/lib/gallery.ts`) and the tutorial card (`gen-tutorial-thumbs.ts`), so
  retiring it is a separate editorial call about what the gallery shows.
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

Two things the session had to carry: `replaceDisplay` builds the new display from
its own config rather than carrying the old one's height, so the tour's session
pins a `displays` array (packed first, multi-row second with a height) — which is
the shape this page's config section prints anyway. And the tutorial's copy of
`multirow/display_types_menu` is gone, the composite being a menu cascade over
its own result; the user guide keeps it, having no tour.

## The rest, ranked

5. **`epigenomics/bisulfite_contexts`** (`bisulfite.md`) — `Color by... →
   Bisulfite / EM-seq` cycling **CpG → CHG → CHH** on one pileup, over
   `NC_003070.9:4,398,000-4,412,000`, the gene body dropping out while the LTR
   element stays red. Deletes a **three-panel stacked figure** that exists only
   to make a comparison one track can make by itself. Risk: it is a pileup, and
   `website/CLAUDE.md` warns those block the main thread under swiftshader — try
   `--headed` first.
6. **`sv/multisample_sort`** (`sv_multisamples.md`) — right-click →
   `Sort by genotype`, 3,202 unordered rows re-laying into three contiguous
   bands, then `Clustering → Cluster rows by genotype...`. Pure re-layout whose
   before and after are two pictures with no visual link. Risk: the callset
   streams from EBI FTP.
7. **`hic/two_regions`** (`hic_structural_variants.md`) — type
   `chr9:130,600,000-131,000,000 chr22:23,100,000-23,400,000` into the location
   box and watch the wedge between the two triangles fill. One text entry, and
   it is the page's central claim. Do not film the scan; that is terminal
   output.
8. **`synteny/allvsall_launch_from_selection`** (`allvsall_synteny.md`) — a
   rubberband on the scalebar → `Launch → Linear synteny view` → a dialog
   listing every assembly it found **with reorder arrows** → a one-row view
   becomes a five-row stack. The page flattens it into a three-link composite
   whose middle panel is a dialog no still can show being reordered.
9. **`synteny/restack_around_locus`** (`multiway_synteny_grape_peach_cacao.md`)
   — the only section on that page with **no figure at all**, and it describes
   exactly what a still cannot hold: a drag-select, a dialog whose rows the
   reader reorders with arrows, and a relaunch that re-lays out the whole stack.
10. **`synteny/liftover_launch`** (`genomes_synteny.md`) — right-click a chain
    block → the launch dialog's CIGAR checkbox → `Replace current view`. The
    page carries a four-panel composite that is a route flattened into stills
    **on the wrong dataset**, and filming this lets it delete the panTro6/_FTO_
    detour that breaks its spine.
11. **`synteny/dotplot_reorder`** (`mcscan_synteny_grape_peach.md`) —
    **Re-order chromosomes** physically re-sorts the vertical axis using the
    alignments, and the figure shows only the after. Five seconds.
12. **`epigenomics/chromhmm_cluster`** (`chromhmm.md`) — cluster the
    127-epigenome track. The page's only figure is already a *result* of that
    run, so the reader takes the tidy order on faith.
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
