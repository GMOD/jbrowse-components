# website/scripts

Capture races and callout anchoring: `agent-docs/reference/FIGURE_CAPTURE.md`.

## Screenshots

- Run `generate-screenshots.ts` with `node`, **never `npx tsx`**: its
  `keepNames` breaks `page.evaluate`'d functions.
- **Never capture against a stale app.** Rebuilding `@jbrowse/web` is always
  fine, and the run rebuilds a local build older than the checkout before it
  captures. Don't pass `--allow-stale` to save the build time. An app behind
  `--port` only reports itself (`FIGURES CAPTURED AGAINST A STALE APP BUILD`);
  restart it from current source. `pnpm --filter jbrowse-web build` matches
  nothing and exits 0; the package is `@jbrowse/web`.
- `--cover` proves every type still paints, never that a figure is current.
- `python3 website/scripts/report-stale-figures.py` lists figures shot before a
  hosted file they draw last changed. Run it after rebuilding hosted data.
- Size a figure from the run's `CONTENT CLIPPED BELOW THE FOLD` /
  `blank below the last content` report, not off the PNG. Neither sees a display
  overflowing its own fixed height; `heightMode: 'grow'` exposes a pileup's.
- A spec timing out at readiness is slow or broken: raise `readyTimeout` or fix
  the display, never add a sleep. `DISPLAYS NOT PAINTED AT CAPTURE` names a
  frame that may be blank.
- **A wait on app work is `{ type: 'waitForAppSettled' }`**, not a `delay`.
  Measure before converting one
  (`PROBE_SPEC=<name> node scripts/probe-app-settled.ts`):
  `search_feature_highlight`'s delay covers no app work, and shortening it moved
  every glyph's antialiasing past the diff gate. Tooltip delays stay `delay`s; a
  menu or dialog ending an action list needs none, nor does a click or type,
  which waits for its target.
- **Every annotation `anchor`s** by locus, cell, graph node, element, chord
  label (`{ chord: 'SV_20' }`) or ideogram band, never by a measured pixel. A
  chord's feature id is parse order and drifts; its label does not. A pointing
  label is `leader: true` on the text, never a pill plus an `arrow`.
- Prefer a session `highlights` entry to a callout: its `label` lands in every
  linked view, on the genome band, the alignment's column and the structure's
  residue, and the figure's live link carries it.
- **A spec edit stales `galleryLinks.generated.ts` and
  `liveLinks.generated.ts`**, and no figure check says so. Run `pnpm autogen`.
- A click that changes state belongs in the session spec, since the figure's
  recipe command clicks nothing. `clicksOpen` / `clicksChange` name the
  exceptions.
- Captures rasterize in software: a spec dying on volume says something about
  swiftshader, not about the product, and stays out of captions.
- Use a short `TMPDIR`; Chrome dies on the scratchpad path length. Downscale a
  PNG before reading it.

## Review app (`pnpm review-screenshots-web`)

- An edit to `scripts/review-app/` needs a page reload, not a restart. The write
  protocol is shared with jbrowse-web's snapshot review
  (`@jbrowse/browser-test-utils/reviewApp`).
- After touching the card, run `probe-review-layout.ts` and
  `probe-review-compare.ts`; neither can pass over an empty list.
- A card's live link opens the hosted build, not the app the figure came from;
  the **Live links** header control points them at a local `pnpm start`.
