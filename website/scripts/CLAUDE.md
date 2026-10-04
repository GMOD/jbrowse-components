# website/scripts

## Screenshots

`scripts/generate-screenshots.ts`, run with `node` — **not `npx tsx`**, whose
`keepNames` breaks `page.evaluate`'d functions. Specs in
`scripts/screenshot-specs.ts`. Capture races and callout anchoring are both
`agent-docs/reference/FIGURE_CAPTURE.md`.

- The package is `@jbrowse/web`; `pnpm --filter jbrowse-web build` matches
  nothing and exits 0. The generator serves the BUILD's `test_data`.
- An inline key on a spec's `tracks` entry reaches a config slot or a model
  prop; one that is neither is dropped silently.
- `--filter` implies `--force`. `--cover` proves every type still paints, never
  that a figure is current.
- **Size a figure from the run's `CONTENT CLIPPED BELOW THE FOLD` /
  `blank below the last content`, not off the PNG.** Neither sees a display
  whose content overflows its own fixed height; on a pileup,
  `heightMode: 'grow'` turns that into page height they can see.
- **Readiness is `@jbrowse/capture`'s gates**: the census holds the spec's
  assembly and trackIds, `[data-app-phase="ready"]` holds, and every display
  paints (`waitForReady` in `scripts/screenshot-ready.ts`). A spec that times
  out there is slow or broken; raise `readyTimeout` or fix the display, and
  never reach for a sleep. `no census on the page at all` means
  `products/jbrowse-web/build` is stale. Rebuild.
- **`DISPLAYS NOT PAINTED AT CAPTURE` names a frame that may be blank**, from a
  spec that set `allowUnsettled` or a display that went blank after the gate.
  Don't accept a plausible-looking figure.
- **A sleep that waits on APP WORK is `{ type: 'waitForAppSettled' }`.** A click
  that navigates, launches, re-sorts or refetches leaves work running that every
  other wait in the spec is silent about — the menu going away is not the pileup
  coming back — and a fixed `ms` for it is wrong in both directions, one of them
  silently. Two conversions are byte-identical to their committed figure
  (`alignments_soft_clipped_menu`, `alignments/select_arc_display`, saving 0.1s
  and 2s), and one is not: `search_feature_highlight`'s delay covers no app work
  at all, and capturing it 200ms earlier moved the antialiasing of every glyph
  on the page past the diff gate. So **measure before converting** —
  `PROBE_SPEC=<name> node scripts/probe-app-settled.ts` samples the app's own
  phase while the wait runs and says which kind of sleep you have. A menu
  animation, a tooltip delay or a hover settling stays a `delay`.
- **A chord is anchored by its label, and hit-tested through the model** —
  `anchor: { chord: 'SV_20' }`, resolved by `chordAnchor.ts`. A resting chord is
  GPU pixels, not a DOM node (ADR-177), and a feature id is parse order, so it
  drifts silently (a comment in `specs/sv.ts` named the id for SV_20; that id is
  SV_14 today). The resolver finds the shape by the label the hover tooltip
  shows, takes its outline from the display's `shapePathFor`, walks the curve,
  and asks the view's `chordAt` what is on top at each point — a buried one
  resolves to nothing rather than clicking its neighbour. Waiting for "chords
  drawn" reads the renderer group's `data-chord-count`.
  `node scripts/probe-chords.ts <spec> --click=<label>` lists what was drawn and
  says what the pick answers along the named one. A chromosome's ideogram band
  is `anchor: { ideogram: 'mm39 chr11' }`, placed by the view's `bandCenter` and
  checked by its `bandAt`.
- **`waitForText … hidden` means "nothing a reader can see says it".**
  Puppeteer's own visibility test is "has a box and is not styled away", and an
  element clipped by an ancestor's `overflow: hidden` keeps both — so a wait can
  hang forever on text no pixel of which was drawn. A JBrowse view is full of
  those: a display renders block placeholders past the edges of the track
  container that clips them. `waitForVisible` now polls from Node for BOTH
  selectors and text and rejects the clipped case (`hidden`/`clip` only, never
  `auto`/`scroll`, so a scrollable menu still counts as open).
  `probe-loading-text.ts` names what is still saying it, with a rect, a hit test
  and an outlined screenshot; `probe-visible-text.ts` says what is on screen
  instead.
- **Does a finished clip MOVE?** `node scripts/probe-clip-motion.ts <clip.mp4>`
  counts distinct frames. Headless Chrome paints the foreground tab, so a
  screencast off a backgrounded one delivers the same frame over and over at the
  right duration and the right size — every number the run prints is fine and
  the picture is frozen.
- **Every annotation `anchor`s** — by locus, dotplot cell, graph node or chord,
  never a measured pixel. Shapes belong in
  `products/jbrowse-capture/src/annotationOverlay.ts`. Prefer an in-app
  `highlight` to an overlay. A band under 24 CSS px carries no chip and clips
  any `label` to nothing (`CHIP_MIN_WIDTH`, and the band is `overflow: clip`),
  so at whole-chromosome scale the caption does the naming. Alpha it for what it
  sits over: a wash marking a REGION can be opaque, one pointing at a feature
  inside itself cannot.
- **A spec edit staleness `galleryLinks.generated.ts` and
  `liveLinks.generated.ts`, and no figure check says so.** The regen writes the
  PNG and the store takes it, while the gallery card's and the doc figure's live
  links keep opening the window, height or label the spec used to have.
  `pnpm autogen` regenerates both; two links sat wrong on main for a day because
  a pass that reframed a figure never ran it. The site reads those two files
  rather than the specs because `scripts/screenshot-specs.ts` and
  `scripts/video-specs.ts` reach `@jbrowse/browser-test-utils`, whose barrel
  loads puppeteer — `scripts/astroImportGraph.test.ts` is the gate.
- **A label that points at something is `leader: true` on the text**, never a
  pill plus its own `arrow`: the tail belongs at the pill's edge and only the
  page knows how wide the pill is.
- Captures rasterize in software, so a spec that dies on volume is a claim about
  swiftshader until checked on real hardware. Don't write one into a caption as
  a product limit.
- Downscale before reading a PNG (`convert x.png -resize 1400x`). Use a short
  `TMPDIR`; Chrome dies on the scratchpad path length.
- The sweep is weekly, not a PR gate — nearly every spec fetches remotely.

## Reviewing them: `pnpm review-screenshots-web`

Rebuilt on every page load, so an edit to `scripts/review-app/` needs a reload,
not a restart. It shares its write protocol and repaint properties with
jbrowse-web's snapshot review through `@jbrowse/browser-test-utils/reviewApp`.
Run both probes after touching the card, and note neither can pass over an empty
list:

- `node scripts/probe-review-layout.ts` — the page holds still while figures
  load.
- `node scripts/probe-review-compare.ts` — the compare view is the page's,
  **including on a card that was off screen when it changed**. The fade is
  written to elements rather than rendered, and only to what is on screen, so a
  broken catch-up says nothing anywhere.

**A card's live link opens the hosted build, which is not the app the figure
came out of.** The header's **Live links** control points them at a local
`pnpm start` instead; it is a prefix swap over `CODE_BASE`, so figures with an
absolute URL keep the link they had, and every tooltip names the host it
reaches.
