# Screenshot review — plan for the next agent

Continues the screenshot-review cleanup. The mechanical bucket (sizing /
annotation / stage tweaks) is **done** — 25 entries fixed, regenerated, verified,
and flipped to `good` in `screenshot-review.json`. This plan covers the **20
entries still marked `bad`**.

`screenshot-review.json` is the review log (gitignored, local coordination only).
Each entry's `note` is the reviewer's ask; `status` is `good`/`bad`.

## How the system works (read first)

- Specs live in `website/scripts/screenshot-specs.ts`. One object per figure;
  `name` == the PNG path under `website/static/img/`.
- PNGs are rendered by `website/scripts/generate-screenshots.ts` driving puppeteer
  against the **built** `products/jbrowse-web/build`. A build already exists; you
  only need to rebuild (`cd products/jbrowse-web && pnpm build`) if you change
  **app/plugin code** (not needed for spec-only edits).
- Run from `website/`:
  ```
  node --experimental-strip-types scripts/generate-screenshots.ts --filter <name> --exact
  ```
  (Use the npm alias `pnpm generate-screenshots -- --filter <name> --exact`. NOT
  `npx tsx` — its keepNames breaks `page.evaluate`.) Drop `--exact` for substring
  matching, but beware broad filters pull in expensive remote specs.
- **Content-stable writes**: an unchanged spec re-renders byte-identical and is
  `≈ kept`; only a real change `✓ updates` the PNG (>0.5% pixel diff). So many
  "bad" entries were just stale PNGs — the spec was already fixed by a prior
  agent but never regenerated. Always regen before assuming a fix is needed.
- **Viewing PNGs**: capture is 1500w @2x ≈ 3000px wide, too big for the Read
  tool. Downscale first: `convert static/img/<name>.png -resize 1100x /tmp/x.png`.
  To read coordinates at CSS scale, `-resize 1500x` (capture is 2x, so 1500w ==
  CSS px) then crop the region of interest.
- Annotations (`type: arrow|box|text|circle`) can `anchor:{selector|text}` so the
  callout tracks the real element; `text` pills are always white/red (the
  `background`/`textColor` fields are ignored). See the `Annotation` interface
  comments at the top of `screenshot-specs.ts`.
- Two generators can't run at once (both bind port 3334). Batch remote specs in a
  single background loop.

## Remaining work, grouped by effort

### Tier 1 — doc text only, no regen (do these first, ~minutes)

- **`customized_feature_details`** — reviewer: the caption "The callback turns the
  name into a clickable link" is too vague. Find the `<Figure>` (grep
  `customized_feature_details` under `website/docs`) and rewrite the caption to
  say concretely what the jexl callback does. Flip to `good`.
- **`rnaseq/compact_stacked`** — reviewer: soften over-claims like "The depth of
  read coverage is a direct, quantitative measure of expression level." Grep the
  doc, nuance the prose (coverage correlates with but isn't a direct measure of
  expression). Flip to `good`.

### Tier 2 — spec/config tweaks + regen (likely quick wins)

- **`cnv`** — reviewer asks if there's a mechanism to shrink scatterplot point
  size. **There is**: `scatterPointSize` is a wiggle config slot
  (`plugins/wiggle/src/shared/WiggleScoreConfigMixin.ts`, consumed by the GPU +
  Canvas2D wiggle renderers). Add `scatterPointSize: <small>` to the cnv spec's
  `displaySnapshot`, regen, verify the points are smaller.
- **`sv_cgiab/synteny_view`** — "synteny area still short." The note says a prior
  agent set `levels:[{height:260}]` — that's the **wrong key**. Per the
  `key_pattern_synteny_levelheights_init` memory, a `levels` snapshot is silently
  dropped; the band height must be set via `levelHeights:[260]` on the
  `LinearSyntenyView`. Fix the key, regen, verify the band is taller.
- **`linear_synteny`** — "increase height + opacity + diagonalize." The spec
  already has `alpha:0.5, levelHeights:[360], autoDiagonalize:true`. Regen and
  verify it actually applies; if the band is still short, same `levelHeights`
  caveat as above. Likely just needs regen + flip to `good`.
- **`linear_synteny_gallery`** — reviewer wants it to literally be the share link
  `?config=test_data%2Fconfig_dotplot.json&session=share-4MjF5YGM_G&password=rByjt`.
  The spec already uses exactly that URL. Regen; if it renders the curated
  session, flip to `good`. If it fails (the `synteny_canvas_done` gate can be
  flaky — it timed out once for `synteny_from_dotplot_view` then passed on retry),
  retry / bump `settleMs`.
- **`breakpoint_split_view`** — reviewer wants top view track order
  `reads,variants` and bottom `variants,reads`. Edit the `tracks:[...]` order in
  each of the two views in the spec, regen, verify.

### Tier 3 — deep code investigations (real engineering; verify in-browser first)

- **`sv_synteny/linear_synteny_genes`** ⚠️ **real bug, high value** — in a
  3-assembly synteny stack, ribbons render for level 1↔2 but NOT 2↔3 ("the second
  layer of LinearSyntenyViewHelper is not displaying"). Investigate
  `plugins/linear-comparative-view/src/LinearSyntenyView` multi-level rendering
  (the per-adjacent-pair nesting; see `key_pattern_synteny_levelheights_init` —
  flat `tracks[]` is level 0 only, nest per adjacent pair). Reproduce in the
  browser, prove the hypothesis with logging before patching.
- **`alignments/read_cloud`** — read-cloud features for short-insert pairs render
  <1px and vanish. Enforce a 1px minimum feature width in the read-cloud
  draw/geometry path (`plugins/alignments`, the samplot/read-cloud renderer).
- **`inverted_duplication`** — the orange "read chain has a supplementary
  alignment" coloring overwhelms the navy/green discordant-pattern colors.
  Investigate the read-chain coloring (`plugins/alignments`, color-by logic) — is
  there a less dominant treatment for supplementary chains? Design call; surface
  options to the user.
- **`alignments/arc_display`** — reviewer wants a "hide pileup" toggle, OR an
  "additive construction" model so there isn't a maze of hide-toggles. Open design
  question — **ask the user** which direction before building.
- **`variants/population_1000genomes`** — legend has too many labels; wants a
  "show more" affordance and richer legend metadata (it currently mixes the
  variant homozygous-alt coloring with sidebar label coloring). UI feature work in
  the variants legend component.
- **`multisv`** — gene-glyph packing looks looser than origin/main. Prior agent's
  investigation (inconclusive) is recorded in the note: only branch diff found was
  `LABEL_FONT_SIZE` 11 (webgl-poc) vs 12 (main) in
  `plugins/canvas/src/RenderFeatureDataRPC/constants.ts`, but the math predicts
  webgl-poc should be *tighter*. Needs a maintainer decision / deeper layout diff.
- **`trio-matrix-phased`** and **`trio-matrix-phased-clean`** — render looks
  "lighter" on origin/main and the black position-connector lines look better
  there. Likely a subpixel/antialiasing regression on this branch. Compare the
  matrix/connector draw path vs main; may be a GPU vs Canvas2D rendering
  difference. Investigate together (same root cause).

### Tier 4 — capture method / blocked

- **`bigwig/whole_genome_coverage`** — reviewer wants a multi-stage figure showing
  the setup, or a puppeteer screencast/video. Build a multi-stage spec walking
  through the whole-genome view setup. (Screencast would need new tooling — scope
  with the user.)
- **`desktop-add-track`** — wants red-highlight annotations on the desktop
  File→Open track flow. This is a **desktop** (Electron) capture, not the
  puppeteer web pipeline — confirm how desktop screenshots are produced before
  attempting; annotations may not be supported there.
- **`sv_cgiab/translocation_sv_inspector_view`** (deferred) — highlight the
  chr3↔chr13 chord via mouseover. Chords are per-feature SVG paths
  (`data-testid="chord-<featureId>"`, `plugins/circular-view/src/ChordRenderer/Chord.tsx`,
  hover → `strokeColorHover`). Need the specific feature id (depends on the remote
  HG008 VCF) — run the app, inspect the chord testids, find the chr3↔chr13 one,
  then `hover` that selector in the spec.
- **`alignments/modifications1`** (deferred) — kept declarative
  `colorBy:modifications` because driving the live Color-by menu is unreliable on
  the COLO829 GPU display (mod-data repaint closes the MUI cascade). Could retry
  with a longer pre-menu settle; otherwise leave (the caption already documents
  the menu path). Low priority.
- **`add_track_tracklist`** (deferred, product/docs decision) — reviewer suggested
  "just show File→Open track," but that duplicates `add_track_form` and breaks
  this figure's purpose (it documents the **FAB** as an *alternative* launch).
  **Ask the user**: ring just the FAB (drop the two-step framing) vs follow the
  note literally + rewrite caption.

## Suggested order

1. Tier 1 (doc text) — instant wins.
2. Tier 2 (`cnv` point size, `sv_cgiab/synteny_view` levelHeights key,
   `linear_synteny` regen, `linear_synteny_gallery` regen, `breakpoint_split_view`
   order) — high confidence, just regen + verify.
3. `sv_synteny/linear_synteny_genes` — the real bug, worth the dig.
4. Remaining Tier 3 investigations + Tier 4, surfacing design questions to the
   user as they come up.

Always: edit spec → regen with `--filter <name> --exact` → downscale + Read the
PNG to verify → flip `status` to `good` with a note in `screenshot-review.json`.
