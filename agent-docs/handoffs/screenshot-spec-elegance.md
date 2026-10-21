---
name: screenshot-spec-elegance
description: "Making the screenshot specs (website/scripts/specs/) and their generator say each thing once. Landed: schema validation of every spec session, an action union, one tooltip field, the delay ratchet. Open: the clicks a session key already replaces (each needs a capture A/B), one session-URL builder, display-type inference for recipes, and the spec respell that waits on ADR-238."
---

# Screenshot specs: what is left

Started 2026-10-21 from a scan of the 42K lines under `website/scripts/specs/`
and the generator. Most of the clutter is the app missing a way to say
something, so the larger half of this list is app work.

## Landed

- `specSessionSchema.ts`: `check-specs` and `generate-screenshots` run every
  spec session through `$defs/View` and `validateConfig`.
- `ScreenshotAction` is a discriminated union; `tooltip: 'hide' | 'expect'`;
  five unused spec flags removed.
- `LONG_DELAY_BASELINE` in `screenshot-spec-rules.ts` counts delays of 1 s or
  more (145 at the start).

## Next, each needing a capture A/B on ada

- **Right-click sorts to `sortRowsBy`**: `multisv`, `multisv_svtype`,
  `multisv_rhd` (ui.ts) and `paper-cohort.ts`. `sortRowsByGenotypeAt` sorts
  on the first record whose span holds `pos`, and the menu sorts on the record
  under the pointer, so where SVs overlap the two can pick different records.
  A video tour starts from `multisv_rhd`'s url
  (`multisvVideoFixtures.unsorted`), so the figure needs a sorted url of its
  own.
- **`tracklist: true`** where a spec opens the track selector by its button
  (the `'button'` and `'text'` arms of `openTrackSelector`). The `'menu'` arm
  films the tutorial route and stays.
- **`maf.ts` 470-way `forceLoad`**: its comment cites a 1 MB limit, and
  `LinearMafDisplay`'s is 5 Mb (REGION_TOO_LARGE.md). Capture it without the
  key and compare.
- Each delay converted to `waitForAppSettled`, after
  `probe-app-settled.ts`; lower the baseline as they go.

## Next, no capture needed

- **One session-URL builder.** `sessionSpec`, `lgvSession`, `kgUrl`,
  `cgiabUrl`, `hpyloriUrl` and hand-built strings in `ld.ts`, `qc.ts` and
  `popgen.ts` differ in whether they encode the config. One
  `sessionUrl({ config, session })` that still returns the string keeps every
  consumer of `spec.url` working. Byte-identical urls keep
  `liveLinks.generated.ts` still.
- **Display type from the track type.** About 400 `type: '…Display'` entries
  exist so the recipe builder (`spec-recipe/decode.ts`, `specDisplayType`) can
  name the menu row; `hostedConfigs.generated.ts` already holds each track's
  type.
- **Derive the spec barrel** in `screenshot-specs.ts` from the directory, as
  `screenshot-impact.ts` already discovers modules, with compose specs last.
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
