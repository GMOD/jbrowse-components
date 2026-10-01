---
name: tutorial-tours
description: Video tours worth filming — tutorial pages whose route a figure cannot carry, ranked by the prose each tour would delete over the risk of filming it; the thirteen untoured pages that should NOT get one; the tours that open on an app with no genome or no track; and the harness gaps behind both. Read before writing a video spec for a tutorial or proposing a tour for an entry-point page.
audience: internal
---

# Tutorial tours worth filming

**Colin's standing preference: film the TUTORIALS before the user guides.** The
three tours filmed on 2026-08-21 were two user guides and a quickstart, which is
the wrong end of the corpus to have started at. `tutorial-tours-from-scratch.md`
holds the remaining user-guide proposals and the harness analysis; this file is
the tutorial half and is the one to work from.

Every candidate below came out of the ten-agent tutorial audit
(`tutorial-corpus-audit.md` §5-6 is that audit's structural half). Each names the
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

## What is still missing from the harness

In `tutorial-tours-from-scratch.md`, which is where the numbered gaps live.

## Tours that start near scratch

### What "from scratch" can mean, ranked by what the harness can drive

| rank | starting point | drivable | cost |
| --- | --- | --- | --- |
| 1 | `url: ''`, no config at all | **no** | needs gap 1 below |
| 2 | a config with **no assemblies** (`test_data/empty.json`) | yes | the tour adds a genome first |
| 3 | an assembly, **zero tracks** (`test_data/hg38_only.json`) | yes | one remote fetch per track |
| 4 | a config with `views: []`, the launcher panel | yes | none |
| 5 | a view's empty import form | yes | none |
| 6 | assembly plus one light track, subject data absent | yes | none |
| 7 | JBrowse Desktop's start screen | **no** | see below |

Rank 1 is one click away in the app and unreachable in the harness. The
fresh-install banner's only affordance is
`<a href="?config=test_data/volvox/config.json">`
(`products/jbrowse-web/src/components/LoaderErrorBanner.tsx:25`), and that is a
same-tab navigation, which gap 1 explains.

**Desktop cannot be filmed with this harness**; an `x11grab` recorder over the
Xvfb display the Selenium run already uses can, and
[tutorial-corpus-audit](tutorial-corpus-audit.md) §2 has that route. Desktop figures come from a Selenium + Electron run over the
packaged binary (`products/jbrowse-desktop/test/screenshots.ts`), whose only
capture call is `driver.takeScreenshot()`; `scripts/generate-video.ts` drives a
page in puppeteer Chrome and films with `page.screencast`. Electron's
chromedriver does not expose the CDP-backed window commands
(`reference/FIGURE_CAPTURE.md` §"Capture size"), So `quickstart_desktop.md`, which carries
the heaviest click-narration in the docs and is the page a tour would gut, is
out of reach.

**The honest conclusion**: from-scratch belongs on the entry-point pages and the
zero-figure user guides, not on the dataset tutorials. A tutorial's data is
remote and heavy; an `hprc_end_to_end` that also added its own assembly would be
minutes of fetching under a cut.

### The proposals

**Tutorials come first, and they are the ranked list above.** That is Colin's
standing preference. What stays here is the from-scratch analysis, the harness
gaps, and the user-guide proposals for when the tutorial list is worked down.

Ordered by (value to a reader) / (risk the harness chokes). Each names the prose
it would let its page delete, since a tour that only adds is the weaker kind.

5. **`ui/open_connection_hub`** — `user_guides/connections.md`, 105 lines and
   **zero figures**. Opens on `hg38_only.json` (`"tracks": []`), so everything on
   screen at the end came from the hub. Films the behaviour the page asserts and
   cannot picture: expanding a category is what fetches.
6. **`ui/spreadsheet_row_launch`** — `user_guides/spreadsheet_view.md`, 41 lines,
   **zero figures**, two thirds bulleted clicks. Half the steps are already
   proven in `videos/sv.ts`.
7. **`synteny/launch_from_lgv`** — `user_guides/linear_synteny_view.md`. The
   densest unfigured passage in the guides: a dataset field that refetches, a
   panel list with arrows, and a neighbours rule that means nothing until the
   list is on screen. `three_strain_import` films the *other* way into this view.
8. **`ui/circular_chords`** — `user_guides/circular_view.md`. Three sequential
   claims, one still: an empty ring, chords appearing when a track is ticked, and
   a chord click opening a second view.
9. **`ui/plugin_store_install`** — `user_guides/plugin_store.md`, 40 lines with
   **no menu path anywhere on it**. The tour supplies the missing route and shows
   the consequence: a menu that was not there a second earlier.

### Machinery gaps

1. **A same-tab navigation kills the overlay, silently.** `injectOverlay` runs
   once before the first step (`generate-video.ts:353`); the re-inject exists
   only on the `opensTab` branch (`:383-390`). Every overlay helper null-guards,
   so after a navigation the clip keeps filming with no cursor and no captions
   while the `.vtt` still ships every line, and no line of `video-report.ts` sees
   it. **This is the whole distance between rank 2 and rank 1.** A
   `navigates?: boolean` on `VideoStep` mirroring the `opensTab` branch fixes it.
2. **`VideoSpec` has no `allowUnsettled` and no `expectedConsole`.**
   `ScreenshotSpec` has both, and a no-config tour needs both.
3. **`scrollTo` cannot scroll a drawer or a dialog.** `scrollPage` walks up from
   `[data-testid^="view-container-"]` (`video-overlay.ts:214-239`), so on a tour
   whose subject IS the drawer it scrolls the views instead. Blocks proposal 9;
   today the only lever is a taller viewport.
4. **`ResizeHandle` publishes no selector** (`packages/core/src/ui/ResizeHandle.tsx:69-87`)
   — a bare `<div>` with emotion classes. A track-height drag is therefore
   measured pixels, which is the one thing this corpus refuses, so
   `config/settings_to_json` drops its drag. Two-line fix on the component.

7) **The LGV import form's Open button has no testid**
   (`ImportForm.tsx:196-203`), and `Open` is a prefix of `Open from a URL`,
   `Open track...` and `Open file from URL or local computer`. `videos/sv.ts:200-209`
   records what that cost once already.
8) **Nothing pairs a typed URL with the page that prints it.**
   `validateVideoSpecs` demands a `pastedTrackConfigs` entry only for a `type`
   step whose value starts with `{`, and `check-paste-configs` compares against
   `json*` fences only. The exposure is already live: `sv/inspector_route` types
   a VCF URL against the one at `sv_inspector_view.md:44`, and a rehost moves one
   and not the other. Extending the pair
   to `{ video, doc, text }` needs no new mechanism.
9) **There is no embedded mode for a tour.** `VideoSpec` carries a `url` and
   nothing else, and `generate-video.ts` serves the jbrowse-web build
   (`dev-harness.ts`, `jbrowseWebRoot`); the screenshot harness has had
   `mode: 'embedded'` with a `viewState` prop all along
   (`screenshot-embedded.ts`, which is how `embed_linear_genome_view/final` is
   captured). So the two pages whose subject IS the embedded component are out
   of reach and were ruled out on that in the 2026-08-21 re-survey:
   `tutorials/embed_linear_genome_view.md`, and `scrna_pseudobulk.md`'s
   UMAP-filters-the-rows link, which lives in the react-LGV examples site.
   Neither is a tour worth building the mode FOR — recorded so the next survey
   does not re-derive it.
10) **A dialog's own scrollable field cannot be scrolled by the harness.** Gap 3
    covers the drawer and the dialog as containers; this is one level in from
    that. `config/settings_to_json` ends on a 20-row readable-JSON panel whose
    keys are most of the way down an 80-line session, and the only lever is to
    click into the textarea and `press` PageDown, which works because it is a
    real caret rather than because anything supports it. A `scrollWithin`
    naming a selector would cover both this and gap 3.

No fixture is missing: `empty.json`, `hg38_only.json`, `volvoxhub/hub1/hub.txt`
and the volvox bigwig/bed/index set all exist and are served by
`createTestServer` beside the build.
