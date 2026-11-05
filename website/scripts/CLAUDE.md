# website/scripts

Capture races and callout anchoring: `agent-docs/reference/FIGURE_CAPTURE.md`.

## Screenshots

- Run `generate-screenshots.ts` with `node`, **not `npx tsx`**: its `keepNames`
  breaks `page.evaluate`'d functions.
- `--cover` proves every type still paints, never that a figure is current.
- After rebuilding hosted data, run
  `python3 website/scripts/report-stale-figures.py` to list figures shot before
  a file they draw changed.
- Size a figure from the run's `CONTENT CLIPPED BELOW THE FOLD` /
  `blank below the last content` report, not off the PNG. Neither sees a display
  overflowing its own fixed height; `heightMode: 'grow'` exposes a pileup's.
- A spec timing out at readiness is slow or broken: raise `readyTimeout` or fix
  the display, never add a sleep. `DISPLAYS NOT PAINTED AT CAPTURE` names a
  frame that may be blank.
- **A callout or click on a feature, record or row names it**
  (`{ trackId, feature }`, `{ trackId, row }`, `{ chord: '<label>' }`) rather
  than a `fracY`, which lands on another row once a band is added above it. A
  chord's feature id is parse order and drifts; its label does not.
- Prefer a session `highlights` entry to a callout: its `label` lands in every
  linked view and travels with the figure's live link.
- Put a click that changes state in the session spec, since the figure's recipe
  command clicks nothing; `clicksOpen` / `clicksChange` name the exceptions.
- Captures rasterize in software: a spec dying on data volume says something
  about swiftshader, not the product, and stays out of captions.
- Use a short `TMPDIR`; Chrome dies on the scratchpad's path length. Downscale a
  PNG before reading it.

## Review app (`pnpm review` in `website/`)

- An edit to `scripts/review-app/` needs a page reload, not a restart.
- After touching the card, run `probe-review-layout.ts` and
  `probe-review-compare.ts`; neither can pass over an empty list.
