# website/scripts

Before writing or re-shooting a figure spec, read
`agent-docs/reference/FIGURE_CAPTURE.md`; before a video tour,
`agent-docs/reference/VIDEO_TOURS.md`.

- Run `generate-screenshots.ts` with `node`, **not `npx tsx`**: its `keepNames`
  breaks `page.evaluate`'d functions.
- Use a short `TMPDIR`; Chrome dies on the scratchpad's path length. Downscale a
  PNG before reading it.
- Reload the page after an edit to `review-app/`; a restart is not needed. After
  touching the review card, run `probe-review-layout.ts` and
  `probe-review-compare.ts` against a non-empty list: over an empty one neither
  can fail.
