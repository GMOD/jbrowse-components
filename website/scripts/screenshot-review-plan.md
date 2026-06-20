# Screenshot review — plan for the next agent

Continues the screenshot-review cleanup. `screenshot-review.json` is the review
log (gitignored, local coordination only). Each entry's `note` is the reviewer's
ask; `status` is `good`/`bad`. **The json is the source of truth** — this plan
goes stale; trust the json's `status` fields over this file.

## How the system works (read first)

- Specs live in `website/scripts/screenshot-specs.ts`. One object per figure;
  `name` == the PNG path under `website/static/img/`.
- PNGs are rendered by `website/scripts/generate-screenshots.ts` driving
  puppeteer. Run from `website/`:
  ```
  node --experimental-strip-types scripts/generate-screenshots.ts --filter <name> --exact --port=3000
  ```
  `--port=3000` proxies the app to a running dev server
  (`pnpm --filter @jbrowse/web start`) so **app/plugin source edits are picked
  up via HMR with no rebuild** — including regenerated `*.generated.ts` shaders.
  Without `--port`, it renders the built `products/jbrowse-web/build` (needs a
  `pnpm build` after code changes). NOT `npx tsx` (keepNames breaks
  `page.evaluate`).
- **Content-stable writes**: an unchanged spec re-renders byte-identical
  (`≈ kept`); only a real change `✓ updates` the PNG (>0.5% pixel diff). Always
  regen before assuming a fix is needed — several "bad" entries were just stale
  PNGs whose spec a prior agent already fixed.
- **Viewing PNGs**: capture is 1500w @2x ≈ 3000px, too big for Read. Downscale:
  `convert static/img/<name>.png -resize 1300x /tmp/x.png`.
- Shaders: edit `.slang`, run `pnpm gen:shaders` (never hand-edit
  `*.generated.ts`); the dev server HMRs the regenerated module.
- Multi-stage figures: `stages: [{actions, annotations}, ...]` — each captured
  and stacked vertically (`convert -append`); spec-level `crop` applies to every
  frame. `menuCascade`/`cascadeBoxes` drive + box a menu drill-down path.
- Two generators can't run at once (both bind port 3334).

## Done this session (2026-06-19, flipped to `good` in json)

- **modifications1** — spec already drove the live Color-by cascade; verified
  the committed PNG shows the full menu open + boxed, regen was 0% (already
  correct).
- **sv_cgiab/synteny_view** — `alpha:0.2` + `minAlignmentLength:50000` lighten
  the dark overlapping-anchor fans into clean syntenic blocks.
- **bigwig/whole_genome_coverage** — rebuilt as a 2-stage setup walkthrough
  (View → Show… → "Show all regions in assembly" boxed → whole-genome result).
- **trio-matrix-phased** + **trio-matrix-phased-clean** — root-caused the
  "darker than main" look: `variantMatrix.slang` widened sub-pixel variant
  columns to a solid opaque 1px (`MIN_COL_PX`), while main's canvas2d AA blends
  thin columns lighter. Shader now scales fragment alpha by the TRUE
  (pre-widening) column-width fraction (`colWidthPx` varying) → canvas2d-AA
  parity. Connector lines were already byte-identical to main.
- **alignments/arc_display** — added a **"Show pileup" track-menu toggle**
  (`showPileup` MST field + `setShowPileup` + "Show…" submenu checkbox; pileup
  band collapses to height 0 in the `sections` getter, same path as collapsed
  groups). Spec sets `showPileup:false` + taller arc band so only coverage +
  discordant arcs show. Regenerated + verified + flipped to good.
- **variants/population_1000genomes** — `FloatingLegend` (shared by variants +
  alignments pileup) now collapses past `DEFAULT_MAX_ITEMS` (12) with a
  `Show N more…`/`Show less` MUI Link toggle (`maxItems` prop, local
  `useState`). The 1000-genomes legend dropped from ~32 labels to 12 + "Show 20
  more…". Addresses the "too many labels" ask; the "richer metadata" ask
  (3-letter pop codes → full names) was left out — there's no code→name map in
  the VCF metadata.

## Remaining `bad` items

### Needs a running-app exploration

- **sv_cgiab/translocation_sv_inspector_view** (deferred) — highlight the
  chr3↔chr13 chord via mouseover. Chords are per-feature SVG paths
  (`data-testid="chord-<featureId>"`); need the specific feature id from the
  remote HG008 VCF. Run the app, inspect chord testids, hover that selector.

### Deep code — blocked or risky right now

- **alignments/read_cloud** — short-insert pairs render <1px. The read cloud
  draws through the **arc band** (`drawArcsPass` → `features/arcs/compute.ts`),
  which is being actively refactored in the working tree (split-read/arc
  inversion work). A 1px-min-width fix there will collide — wait until that
  refactor lands, then enforce a min width in the arc/cloud geometry.
- **multisv** — gene-glyph packing looks looser than origin/main. Only branch
  diff found was `LABEL_FONT_SIZE` 11 (webgl-poc) vs 12 (main) in
  `plugins/canvas/src/RenderFeatureDataRPC/constants.ts`; the math predicts
  webgl-poc should be tighter. Needs a deeper layout-engine diff / maintainer
  call. Optional ("try a little more").

### Capture-method / product decision

- **desktop-add-track** — wants red-highlight annotations on the desktop
  File→Open-track flow. This is a **desktop** (Electron) capture
  (`products/jbrowse-desktop/test/screenshots.ts`), not the puppeteer web
  pipeline — confirm annotations are even supported there before attempting.

## Workflow

Edit spec/code → (`pnpm gen:shaders` if shader) → regen with
`--filter <name> --exact --port=3000` → downscale + Read the PNG to verify →
flip `status` to `good` with a note in `screenshot-review.json`.
