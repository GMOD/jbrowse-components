---
name: tutorial-tours-handoff
description: Live state of the tutorial video-tour thread — which candidates are filmed, which of the untoured pages are ruled out and why, and the two things about desktop and same-tab navigation that nobody should re-derive. Read before filming a tour; delete when the tutorial list is worked down.
---

# Tutorial tours: where the thread is

## State

**Sixteen candidates are filmed and landed** (2026-08-21): 1 to 4
(`variants/trio_phased_matrix`, `synteny/hg002_dotplot_import`,
`sv/derivative_allele_route` over two pages, `repeats/painting_display_switch`),
then 7, 9 and 11 (`hic/two_regions`, `synteny/restack_around_locus`,
`synteny/dotplot_reorder`), then 6, 8 and 12 (`sv/multisample_sort`,
`synteny/allvsall_launch_from_selection`, `epigenomics/chromhmm_cluster`), then
10 (`synteny/liftover_launch`), then 5 and 13
(`epigenomics/bisulfite_contexts`, `pangenome/tier_to_fine`), then 15
(`config/settings_to_json`, and a new `videos/config.ts`), then 16 and 17
(`genomes_basics/gnomad_filter`, `genomes_basics/find_a_track`, and a new
`videos/genomes_basics.ts`). Coverage is **26 tutorials of 43** — count it with
`grep -L '<Video ' website/docs/tutorials/*.md | grep -v CLAUDE`, since this
line has been wrong three times and the third was the grep counting
`tutorials/CLAUDE.md` as a page.

**Every remaining candidate is blocked.** The 19 untoured pages were re-surveyed
on 2026-08-21 and only four carried one; `genomes_basics` (16 and 17) is filmed,
and what is left is `rnaseq` (14, blocked on its respine),
`orthofinder_synteny` (18, blocked on its respine and on the heaviest figure in
the corpus) and `local_ancestry` (19, which does not fit the frame). The other
fifteen should not get one and the candidates file says why for each — that half
is what stops the next session re-deriving it.

**The swiftshader warning was retired at both ends, and it is about VOLUME.**
`website/CLAUDE.md` says the tours stay off pileups and graph fetches; both of
the candidates that carried that risk filmed headless with nothing starved. 5 is
a per-read pileup — 14 kb of Illumina WGBS over a plant genome, which is not the
deep human ONT lane the warning was measured on — and 13 navigates a linear view
rather than cutting a subgraph, so the FMMM engine never runs. Neither needed
`--headed`, and neither says the next heavy tour will not.

- **[ideas/tutorial-tour-candidates.md](../ideas/tutorial-tour-candidates.md)**
  — the ranked list, and the one to work from. Each filmed entry now records
  what its estimate got wrong, because the next tour on that page starts there.
  Eight of the sixteen found a defect in the page they film, which is the
  strongest argument for the thread: a route nobody walks is a route the prose
  can be wrong about.
- **[ideas/tutorial-structure-audit.md](../ideas/tutorial-structure-audit.md)**
  — eight pages that fail the reorderability test, three that want splitting.
  Still editorial calls nobody has made, minus `ld_mosquitoes`, whose restated
  guide section is gone. `rnaseq.md` is the one that BLOCKS a tour: candidate 14
  films a page whose sections are reorderable, which just films the confusion.
- **[ideas/tutorial-tours-from-scratch.md](../ideas/tutorial-tours-from-scratch.md)**
  — the harness analysis and the numbered machinery gaps. Its ranking is biased
  toward user guides, which is why the candidates file exists separately.

**A tour does not retire a figure.** Two were retired while filming candidate 1
and 4 and restored the same day. The stills and the clips both stay; what a clip
shortens is prose. `website/CLAUDE.md` § Videos carries the rule.

## Where the rules now live

Not here. `website/CLAUDE.md` § Videos has the corpus-level rules (framing,
embedding, the store, the gates), and **`website/scripts/videos/CLAUDE.md`** has
what goes wrong inside a spec's `steps` — each one that cost a refilm is written
up there rather than in this file, so they survive it being deleted.

The order that a run depends on, which no check enforces: rebuild
`@jbrowse/web`, write the `<Video>` tag (`check-video-specs` fails a spec no page
embeds), film, `pnpm figures:push --filter <name>`, commit `media.lock`, then
`pnpm autogen`. Autogen before the push puts a `videoFrames` row in for a clip
with no poster and turns `videoFrames.test.ts` red.

## Verified, so nobody re-derives it

- **Desktop cannot be filmed at all.** Desktop figures come from a
  Selenium + Electron run whose only capture call is `takeScreenshot()`;
  `generate-video.ts` films with `page.screencast` on a puppeteer page. Electron's
  chromedriver exposes no CDP window commands, and every in-app affordance goes
  through the native file picker. So `quickstart_desktop.md` and `cli_desktop.md`
  are out of reach, which is a shame — the first carries the heaviest
  click-narration in the docs.
- **A same-tab navigation silently kills the overlay.** `injectOverlay` runs once
  and the re-inject exists only on the `opensTab` branch, so the clip keeps
  filming with no cursor and no captions while the `.vtt` still ships every line,
  and nothing reports it. This is the only thing between "opens with no config"
  and the deepest from-scratch start. Gap 1 in the from-scratch file.
- **A bare `Add track` is a real label**, rendered by the FAB menu, alongside the
  hamburger menu's `Add track...`. A report that the docs are missing an ellipsis
  there is wrong; see [[two-real-spellings-of-one-menu-label]] in memory.

Delete this file once the tutorial candidates are worked down or refiled.
