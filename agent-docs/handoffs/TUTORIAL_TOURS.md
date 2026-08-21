---
name: tutorial-tours-handoff
description: Live state of the tutorial video-tour thread — which candidates are filmed, where the remaining ones are ranked, and the two things about desktop and same-tab navigation that nobody should re-derive. Read before filming a tour; delete when the tutorial list is worked down.
---

# Tutorial tours: where the thread is

## State

**Candidates 1 to 4 are filmed and landed** (2026-08-21):
`variants/trio_phased_matrix`, `synteny/hg002_dotplot_import`,
`sv/derivative_allele_route` (two pages) and `repeats/painting_display_switch`.
Coverage is **13 tutorials of 43**. Work down from candidate 5.

- **[ideas/tutorial-tour-candidates.md](../ideas/tutorial-tour-candidates.md)**
  — the ranked list, and the one to work from. Each of the four filmed entries
  now records what its estimate got wrong, because the next tour on that page
  starts there.
- **[ideas/tutorial-structure-audit.md](../ideas/tutorial-structure-audit.md)**
  — eight pages that fail the reorderability test, three that want splitting.
  Still editorial calls nobody has made, minus `ld_mosquitoes`, whose restated
  guide section is gone. `rnaseq.md` is the one that BLOCKS a tour: candidate 14
  films a page whose sections are reorderable, which just films the confusion.
- **[ideas/tutorial-tours-from-scratch.md](../ideas/tutorial-tours-from-scratch.md)**
  — the harness analysis and the numbered machinery gaps. Its ranking is biased
  toward user guides, which is why the candidates file exists separately.

## Where the rules now live

Not here. `website/CLAUDE.md` § Videos has the corpus-level rules (framing,
embedding, the store, the gates), and **`website/scripts/videos/CLAUDE.md`** has
what goes wrong inside a spec's `steps` — the three that cost a refilm on
2026-08-21 are written up there rather than in this file, so they survive it
being deleted.

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
