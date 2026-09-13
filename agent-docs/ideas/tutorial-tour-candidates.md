---
name: tutorial-tour-candidates
description: Tutorial pages whose route a figure cannot carry, ranked by the prose each tour would delete over the risk of filming it, plus the thirteen untoured pages that should NOT get one and why. What is left to film is 14, 18 and 19. Read before writing a video spec for a tutorial.
audience: internal
---

# Tutorial tours worth filming

**Colin's standing preference: film the TUTORIALS before the user guides.** The
three tours filmed on 2026-08-21 were two user guides and a quickstart, which is
the wrong end of the corpus to have started at. `tutorial-tours-from-scratch.md`
holds the remaining user-guide proposals and the harness analysis; this file is
the tutorial half and is the one to work from.

Every candidate below came out of the ten-agent tutorial audit
(`tutorial-corpus-audit.md` §5-7 is that audit's structural half). Each names the
prose it makes unnecessary, which is what ranks it.

**A tour does not retire a figure.** Two were retired on 2026-08-21 and put back
the same day: Colin's call is that the stills and the clips both stay, so
"deletes a figure" is not a point in a candidate's favour and not a step in
filming one. What a clip can shorten is PROSE — a paragraph of sequential clicks,
a section that only introduces the next state. `video-specs.ts` states the reason
in its own header: a figure is searchable, diffable, annotatable and readable at a
glance, and none of that survives being filmed.

## The rest, ranked

**The numbers are IDs, not the ranking.** A new entry takes the next free
number.
**Still to film, best first: 14, 18, 19**, and all three are blocked — 14 and 18
on a respine, 19 on the frame.

14. **`rnaseq/group_by_strand`** (`rnaseq.md`) — `Group by... → First-of-pair
    strand` on the MHC class III window. **Do the page's restructuring first**
    (`tutorial-corpus-audit.md` §5): filming a page whose sections are
    reorderable just films the confusion. Note the audit also found the current
    instruction contradicts the figure it introduces.

18) **`orthofinder_synteny/same_scale`** (`orthofinder_synteny.md`) — the view
    menu's **Show all regions - each row fit to width** → **Show all regions -
    same bp per pixel**, one radio, six rows visibly re-scaling from
    equal-length to genome-length, which is what `:82-85` describes and no
    figure holds. `keepMenuOpen: false` on both rows, so it is the one radio
    tour that needs no Escape-and-blur. **Blocked twice**: the target is the
    heaviest figure in `specs/synteny.ts` by its own comment (269,656 gene
    links, a 300s ready gate, the sole synteny failure on the first CI sweeps),
    and `tutorial-corpus-audit.md` §5 condemns the page as three datasets
    with the dependency arrow running backwards through half of it. Re-rank it
    after the respine and after the re-render `TODO.md` has queued for those
    figures.

19. **`local_ancestry/cluster_painting`** (`local_ancestry.md`) — `Clustering →
    Cluster rows by similarity` on the ancestry painting. The prose at
    `:304-306` is genuinely orphaned: `dog10k-wolfdog-ancestry-clustered` was
    deleted, so what that figure knew is a paragraph with no picture. **It does
    not fit the frame.** The claim is about the 243-animal painting, whose 486
    rows were a 2,610px capture, against a 1920-wide encode ceiling and a 960
    default height; filming the 64-row named track instead films rows already in
    descending wolf-fraction order, where the reorder barely moves and "with no
    access to the breed names" mostly evaporates. Revisit if a per-clade cut of
    that BED is ever hosted.

## Pages that should not get a tour

From a re-survey of every untoured page on 2026-08-21. This half is worth as
much as the ranking: each of these looks like a candidate from the index and
stops being one on the page.

**No route on the page at all.** A pipeline page whose payoff is a static
comparison is a still's job by construction, and a tour of it would retire no
prose.

- **`dtu.md`** — the only sentence containing "click" is an aside about where an
  isoform's numbers live. Six sections of shell and one JSON fence.
- **`homoeolog_synteny.md`** — no click, menu, dialog or re-layout anywhere. Its
  one control (`dN/dS`) is named as the destination of a config value. The
  dotplot also opens in ~300s.
- **`selection_pressure.md`** — structurally the best-formed tutorial of the set
  and therefore the emptiest: one palette radio and one ribbon click, both
  within ten lines of the page's only figure, which already shows the first
  one's result.
- **`ld_mosquitoes.md`** — every state it names is a config slot (`groupBy`,
  `colorBy`, `referenceDrawingMode`, `ldMetric`, `minorAlleleFrequencyFilter`),
  and the one menu that could carry a tour is never written as a menu path. Its
  figure's own frame is 1385px, past the 960 default. Sections freely
  reorderable.

**The route is real and already filmed somewhere else.** A second clip of one
cascade teaches a reader nothing new about the app.

- **`dog10k_lof.md`** — one clause naming `Clustering → Cluster rows by
  similarity`, which is `dog10k/igf1_cluster_route` on the sibling page, here
  over 1,987 rows instead of 167 and behind a 180s RPC.
- **`ld_human.md`** — same menu, same display type, same dialog as
  `dog10k/igf1_cluster_route`, at the corpus's slowest open (that page's figures
  need 600s and 300s ready gates) and a 1238px frame it cannot shed without
  dropping the LD triangle the page is about.
- **`population_cnv.md`** — `Clustering → Cluster rows by score...` would be the
  SIXTH clip of that cascade, after tcga_cohort_cnv, dog10k_selection, chromhmm,
  pangenome_hprc, sv_multisamples and the clustering user guide. **Do the still
  instead**: both heatmap figures set `runClustering: true`, so "rows are in
  file order until you do" is pictured nowhere, and an unclustered twin costs
  one spec and is diffable.
- **`scatac_pseudobulk.md`** — the multi-wiggle add-track form is the best
  MECHANISM the survey found (a grid that does not exist until **Add tracks** is
  pressed, an editable Name column, a Submit that unlocks on three conditions),
  and it is on the wrong page: the section is one of three the page declares
  interchangeable, its home is `user_guides/multiquantitative_track.md`, and
  `ui/bulk_add_tracks` is its near twin. **It belongs on the user-guide list.**

**The harness cannot reach it.**

- **`cli_desktop.md`** and `quickstart_desktop.md` — desktop cannot be filmed at
  all; the handoff carries why, so nobody re-derives it.
- **`embed_linear_genome_view.md`** — no route (four code fences and a
  `<details>`), and no way to film one if there were: `VideoSpec` carries only a
  `url` and the generator serves the jbrowse-web build. Gap 9.
- **`scrna_pseudobulk.md`** — delegates its one UI workflow to
  `scatac_pseudobulk` in its own words, and the only thing on it that MOVES (the
  UMAP filtering the rows, a gene selection recolouring the cells) lives in the
  react-LGV examples site. Also under an open merge question with its sibling.

**The page has to be restructured first.** Filming a page whose sections are
reorderable just films the confusion.

- **`dog10k_svs.md`** — two single-step interactions on 618 lines, each already
  in a figure within fifty lines of it, and `tutorial-corpus-audit.md` §5
  names the page as the reorderable case in its own opening words.
- **`mappability_qc.md`** — it HAS the shape: three numbered steps at `:168-179`
  with no figure near them, and a `Score → Summary score mode` flip whose losing
  half is in no picture. Both sit on a 30x remote CRAM that needs `forceLoad` to
  draw at all and whose still costs a 600s ready gate. Revisit with `--headed`
  if that pileup is ever cheap enough.

## Traps, in the order they bit

All of them cost a take or a debug cycle on 2026-08-21.

- **Rebuild `@jbrowse/web` before any run.** The generator serves the BUILD's
  assets, so a component edit made after the build is invisible and the failure
  is a missing selector.
- **Size a dialog-centred tour to the DIALOG.** The run's content report
  measures app height only, so it will tell you to shrink a frame the dialog
  needs. Pull a mid-clip frame with `ffmpeg -ss` and look.
- **The clip's last STATE CHANGE has to be the payoff.** A `recorder.stop()`
  timeout drops whatever ffmpeg had not flushed — twelve seconds of it on
  `gnomad_filter`'s first take — and the run logs that on a line none of the
  four report sections covers. Pull the POSTER and look at it, every time.
- **`cut: true` on a `type` step** is how a paste is filmed. Five URLs typed a
  keystroke at a time read as 9.4s of nothing happening.
- **A re-frame needs `pnpm autogen`**, or the page reserves a box the wrong
  shape. Two generators always refuse in a worktree (jbrowse-img, social card);
  that is main's staleness, not yours.
- **`pnpm figures:push --filter <name>`**, never bare, then commit `media.lock`.
  A figure store with nothing on disk is skipped rather than emptied, which is
  what makes a media-only push safe from a worktree that never pulled figures.
- **Don't film a reader reading.** A tour that ends by scrolling a text panel to
  the line that matters is filming the one thing a page does better: the fence
  beside the clip is searchable, diffable and holds still.
  `config/settings_to_json` spent three takes trying to land a 20-row JSON panel
  on four keys before dropping the scroll entirely, and the clip got shorter and
  clearer for it. A clip carries the route; the page carries the text the route
  produced.
- **A menu path a page prints is a claim, and a `waitForText` is what checks
  it.** Two of the four page defects this thread has found were levels missing
  from a cascade, and both showed up as a step dying by name rather than as
  anything anyone read. Write the path the page prints, not the path you
  verified in the source, and let the run disagree.
- **Check whether the app already did the next step for you.** An action that
  writes one setting can nudge another (`setLinkedReads` sets `colorBy` on the
  way into chain mode), so a tour taking a page's bullets in order can film a
  click that changes nothing and report success. The frame to pull is the menu
  BEFORE the click: a radio already filled in is the tell.

## What is still missing from the harness

In `tutorial-tours-from-scratch.md`, which is where the numbered gaps live.
