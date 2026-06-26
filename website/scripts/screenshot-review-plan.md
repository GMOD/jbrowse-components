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

## Remaining `bad` items

Both render correctly — they're blocked on **remote demo-data regeneration**
(can't upload to jbrowse.org/demos from here), not on any spec/code edit. Each
review-json `note` has the details.

- **sv_cgiab/cnv_multi_bigwig** — the indexcov bigWigs are per-sample
  median-normalized, so normal vs tumor share no common CNV baseline. Proper fix
  is a log2(tumor/normal) ratio track + optional BAF track. Data-gen recipe is
  written at **`website/scripts/cnv-data-recipe.md`**; needs the source CRAMs +
  re-upload to `jbrowse.org/demos/cgiab`, then swap the subadapters in the spec
  and flip to `good`.
- **trio-hapibd-painting** — the gaps are intentional hap-ibd length-threshold
  behavior, documented in `analyze_trio.md` ("Is hap-ibd the right tool?"). Low
  priority. To fill them, re-run with lower `min-seed`/`min-output` and lower
  the conversion script's `MIN_RUN_CM` / raise `MAX_GAP`, or use the
  direct-genotype method already in the tutorial — both trade gaps for
  phasing-error noise and need `trio.hapibd.bed.gz` re-uploaded.

Closed since the last plan: **sv_inspector_importform_filtered** (not a defect —
the SV-search-language enhancement is now filed in `agent-docs/TODO.md`). The
formerly-listed deep items (translocation_sv_inspector_view, multisv,
desktop-add-track, population_1000genomes, embed_linear_genome_view/final,
read_cloud) are all resolved — the json shows only the two above as `bad`.

## Workflow

Edit spec/code → (`pnpm gen:shaders` if shader) → regen with
`--filter <name> --exact --port=3000` → downscale + Read the PNG to verify →
flip `status` to `good` with a note in `screenshot-review.json`.
