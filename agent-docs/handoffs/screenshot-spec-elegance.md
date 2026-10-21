---
name: screenshot-spec-elegance
description: "Making the screenshot specs (website/scripts/specs/) and their generator say each thing once. Landed: schema validation of every spec session, an action union, one session URL builder, declarative sorts and track selectors in place of clicks. Open: the long delays, display-type inference for recipes, one frame arranger, and the spec respell that waits on ADR-238."
---

# Screenshot specs: what is left

Started 2026-10-21 from a scan of the 42K lines under `website/scripts/specs/`
and the generator. Most of the clutter is the app missing a way to say
something, so the larger half of this list is app work.

## Next, each needing a capture A/B on ada

- Each long delay converted to `waitForAppSettled`, after
  `probe-app-settled.ts`; lower `LONG_DELAY_BASELINE` as they go. Shoot a
  baseline at the pre-change commit too: a matrix of sub-pixel rows moves
  single pixels between any two runs.

## Next, no capture needed

- **Display type from the track type.** About 400 `type: '…Display'` entries
  exist so the recipe builder (`spec-recipe/decode.ts`, `specDisplayType`) can
  name the menu row; `hostedConfigs.generated.ts` already holds each track's
  type.
- **One frame arranger** for `compose` and `stages`: the ImageMagick appends
  and the box arithmetic (`annotateComposition`, `stageBoxes`) are written
  twice. The padding policies differ, so merging reshoots every composite.
- **Comments.** About 37% of spec lines are comments, much of it history.

## Waits on ADR-238 (handoffs/vega-lite-vocabulary.md)

The specs respell once, after each concept lands: rows and facet (seven
spellings), compact (four), constant color (four), the y axis (three homes),
legends, and filters (about half the jexl filters are plain equality).
Table-driven spec families (`synteny.ts` multiway lanes and OrthoFinder stacks)
come after the respell, or they are written twice.

## App changes the specs point at

- Launch keys for MsaView and ProteinView, which ship with the protein3d
  plugin release; 12 `*.session.json` snapshots go then.
- A view's track entry taking `{ uri, ...settings }`, after launch-args step 1.
- Two displays of one track in a view: specs register a second session track
  over the same file today (`ui.ts`, `variants.ts`, `hg002_haplotypes.ts`,
  `pangenome_cactus.ts`). A core change for it gets an ADR first.
