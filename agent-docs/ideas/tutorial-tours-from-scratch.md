---
name: tutorial-tours-from-scratch
description: Ten proposed video tours that open on an app with no genome or no track, the four starting points the harness can actually drive, and the five machinery gaps that block the deepest one. Read before proposing a tour for an entry-point page or a zero-figure user guide.
audience: internal
---

# Tours that start near scratch

Twenty-one tours exist across 43 tutorials and 30 user guides. Before the three
this doc's first three proposals became, **one opened on an app with nothing in
it** (`sv/inspector_route`, `sessionSpec(DEMO_CONFIG, {
views: [] })`). Two more are adjacent: `synteny/three_strain_import` opens on an
empty import form, `proteins/gene_explorer` opens outside JBrowse entirely. Two
open with an assembly and one light track and no subject data, so the tour can
add it (`pangenome/hprc_end_to_end`, `ui/open_track_url`). The other thirteen
open with the data already drawn.

**No tour anywhere opens on an app with no assembly.**

## What "from scratch" can mean, ranked by what the harness can drive

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

**Desktop cannot be filmed at all**, and this is worth recording so nobody
re-derives it. Desktop figures come from a Selenium + Electron run over the
packaged binary (`products/jbrowse-desktop/test/screenshots.ts`), whose only
capture call is `driver.takeScreenshot()`; `scripts/generate-video.ts` drives a
page in puppeteer Chrome and films with `page.screencast`. Electron's
chromedriver does not expose the CDP-backed window commands
(`reference/DESKTOP_SCREENSHOTS.md:208-210`), and every in-app affordance there
goes through the native file picker. So `quickstart_desktop.md`, which carries
the heaviest click-narration in the docs and is the page a tour would gut, is
out of reach.

**The honest conclusion**: from-scratch belongs on the entry-point pages and the
zero-figure user guides, not on the dataset tutorials. A tutorial's data is
remote and heavy; an `hprc_end_to_end` that also added its own assembly would be
minutes of fetching under a cut.

## The proposals

**Tutorials come first, and they are in
[tutorial-tour-candidates.md](tutorial-tour-candidates.md).** That is Colin's
standing preference and this file's list does not reflect it: three of its four
filmed-or-top entries are user guides, which is the wrong end of the corpus to
have started at. What stays here is the from-scratch analysis, the harness gaps,
and the user-guide proposals for when the tutorial list is worked down.

Ordered by (value to a reader) / (risk the harness chokes). Each names the prose
it would let its page delete, since a tour that only adds is the weaker kind.

**The first three are filmed** (`9649aa585a`), which took one harness fix and
one new testid; see the gaps below. Seven remain.

1. ~~**`ui/sequence_search_motifs`**~~ **filmed** — `user_guides/sequence_search.md`, 106 lines
   and **zero figures**, three dialog modes never pictured. Opens on an LGV with
   **no tracks at all** and ends with one lane per restriction enzyme, produced
   from the reference itself. Deletes the `Launch as one track` /
   `Launch one track per motif` bullets. Nothing fetches, so this is the cheapest
   clip in the corpus and the pilot.
2. ~~**`ui/bulk_add_tracks`**~~ **filmed** — `user_guides/basic_usage.md`. Five URLs pasted
   scrambled, each index away from its data file, and the preview table sorts
   them. Deletes ten lines that have no figure. The order is the point and
   only a clip can scramble it.
3. ~~**`ui/add_genome`**~~ **filmed** — `quickstart_adminserver.md`, opening on
   `test_data/empty.json`, **no assemblies**. Tools → Assembly manager → Add new
   assembly → Open from a URL → three URLs → the form names the genome itself.
   The prose it replaces is *wrong*: the button is `Add new assembly`, there is
   no "Create New Assembly" anywhere in the tree, and there is no `type:` picker
   on the happy path (`packages/core/src/ui/AddGenomePane.tsx:170-200`).
4. **`genomes/find_a_track`** — `tutorials/genomes_basics.md`. Typing `phyloP`
   into **Filter tracks** collapses ~570 categories to two hits. The page's
   headline claim ("a checkbox away") is three clicks in one paragraph with no
   figure, and a drawer figure was made and cut twice.
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
10. **`ui/settings_to_json`** — `tutorials/display_settings.md`. Three menu paths
    and a drag on the left, four JSON keys on the right, one take. Lowest ranked:
    it rides a CRAM pileup, and a pileup under swiftshader blocks the main thread
    per animated frame.

## Machinery gaps

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
   whose subject IS the drawer it scrolls the views instead. Blocks proposals 2
   and 9; today the only lever is a taller viewport.
4. **`ResizeHandle` publishes no selector** (`packages/core/src/ui/ResizeHandle.tsx:69-87`)
   — a bare `<div>` with emotion classes. A track-height drag is therefore
   measured pixels, which is the one thing this corpus refuses, so proposal 10
   drops its drag. Two-line fix on the component.
5. **A multiline field could not be cleared** — FIXED. `clear: true` triple-
   clicked, which selects one LINE, so on a textarea it left every other line in
   place and typed the new value into the middle of them. It cost a whole take
   of `sequence_search_motifs`: the enzyme list stopped parsing, both submit
   buttons went disabled, and the tour clicked one and filmed nothing happening.
   `actions.ts` calls `select()` now.
6. **The bulk-add paste box had no testid** — FIXED (`bulk_track_urls`). Worth
   noting what the gap looked like from outside: `Open` is a prefix of `Open
   from a URL`, `Open track...` and `Open file from URL or local computer`, so
   there was no text to match on either.
7. **The LGV import form's Open button has no testid**
   (`ImportForm.tsx:196-203`), and `Open` is a prefix of `Open from a URL`,
   `Open track...` and `Open file from URL or local computer`. `videos/sv.ts:200-209`
   records what that cost once already. Three of the ten proposals click it.
8. **Nothing pairs a typed URL with the page that prints it.**
   `validateVideoSpecs` demands a `pastedTrackConfigs` entry only for a `type`
   step whose value starts with `{`, and `check-paste-configs` compares against
   `json*` fences only. The exposure is already live: `sv/inspector_route` types
   a VCF URL against the one at `sv_inspector_view.md:44`, and a rehost moves one
   and not the other. **Six of the ten proposals type a URL, and two of the three filmed ones do.** Extending the pair
   to `{ video, doc, text }` needs no new mechanism.

No fixture is missing: `empty.json`, `hg38_only.json`, `volvoxhub/hub1/hub.txt`
and the volvox bigwig/bed/index set all exist and are served by
`createTestServer` beside the build.
