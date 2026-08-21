---
name: tutorial-tours-handoff
description: Live state of the tutorial video-tour thread — three tours filmed on the wrong end of the corpus, fourteen tutorial candidates ranked and unstarted, and the four traps that each cost a take. Read before filming a tour; delete when the tutorial list is worked down.
---

# Tutorial tours: where the thread is

## State

The ten-agent tutorial audit landed its factual half (`16db847316`..`b8bcde6506`).
Its two open halves are parked in `ideas/`, not here:

- **[ideas/tutorial-tour-candidates.md](../ideas/tutorial-tour-candidates.md)** —
  the work to pick up. Fourteen tutorial pages, ranked, with the fixture and the
  menu path located for the top four.
- **[ideas/tutorial-structure-audit.md](../ideas/tutorial-structure-audit.md)** —
  eight pages that fail the reorderability test, three that want splitting at a
  named seam. Editorial calls, nobody has made them.
- **[ideas/tutorial-tours-from-scratch.md](../ideas/tutorial-tours-from-scratch.md)**
  — the harness analysis and the numbered machinery gaps.

## The correction that put this file here

Three tours were filmed on 2026-08-21 (`4b3efa313c`): `ui/sequence_search_motifs`,
`ui/bulk_add_tracks`, `ui/add_genome`. They are good clips and they stay.

**But two are user guides and one is a quickstart, and Colin wants the
tutorials filmed first.** That is the whole reason `tutorial-tour-candidates.md`
exists as a separate file: the older `tutorial-tours-from-scratch.md` ranking is
biased toward user guides and should not be worked straight down.

Coverage is **9 tutorials of 43**. Start at candidate 1
(`analyze_trio`, whose fixture is already written at
`website/scripts/specs/trio.ts:193-267`) and it retires three of that page's
four figures.

## Before filming anything

The full list is in the candidates file. The four that actually cost a take:

1. **Rebuild `@jbrowse/web`.** The generator serves the build's assets, so a
   component edit after the build shows up as a missing selector.
2. **Size a dialog-centred tour to the dialog**, not to the run's content
   report, which measures app height only. Pull a mid-clip frame with
   `ffmpeg -ss` and look at it.
3. **`pnpm autogen` after any re-frame**, then
   `pnpm figures:push --filter <name>` and commit `media.lock`.
4. **`check-video-specs` fails a spec no page embeds**, so write the `<Video>`
   tag before filming, not after.

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
- **`clear: true` selected one line, not the field.** Fixed this session
  (`website/scripts/actions.ts`), after it filmed a disabled button being clicked
  and reported success.
- **A bare `Add track` is a real label**, rendered by the FAB menu, alongside the
  hamburger menu's `Add track...`. A report that the docs are missing an ellipsis
  there is wrong; see [[two-real-spellings-of-one-menu-label]] in memory.

Delete this file once the tutorial candidates are worked down or refiled.
