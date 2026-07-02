# Variant collapse & label overhang (canvas layout)

Status date: 2026-07-02. Branch: `webgl-poc`. Shared worktree — scope commits to
explicit pathspecs.

Fixes the reported bug: in the single-sample variant track (`LinearVariantDisplay`,
which reuses `plugins/canvas` `packRef`), most variants render on row 0 but **one
or two stack onto extra rows** instead of collapsing.

Touched files: `plugins/canvas/src/LinearBasicDisplay/layout.ts` (the fix),
`RenderFeatureDataRPC/rpcTypes.ts` + `collect/glyphEmitters.ts` (thread a
`densityFade` bool onto `FlatbushItem`), `LinearBasicDisplay/layout.test.ts`.

## TL;DR of what's known (don't re-derive)

- **"Collapse" = the sub-pixel density fade**, not a display mode. The
  `collapse`/`reducedRepresentation` displayModes were removed
  (`migrateBasicSnapshot.ts` maps them → `normal`). The surviving notion: a
  whole-feature **Box** glyph (variants, plain BED) narrower than
  `MIN_RECT_WIDTH_PX` (2px) is drawn semi-transparent (`rect.slang` densityAlpha)
  so dense variants fuse into one density texture. That only reads right if they
  share **one row**.

- **The fix**: in `packRef`, a `densityFade` box whose *rendered* width
  `(endBp-startBp)/bpPerPx < MIN_RECT_WIDTH_PX` is pinned to `layoutMap.set(id, 0)`
  and skips the greedy `GranularRectLayout` — it reserves no vertical space, never
  overflows maxHeight. Genes/wide SVs are untouched. `densityFade` is set once at
  production (`glyphEmitters.ts`, `layout.glyphType === 'Box'`) and read per-feature
  in the loop `packRef` already runs — no per-re-pack rect scan.

- **THE KEY FINDING (the reason this doc exists): the stacking is driven by
  reserved LABEL-span overlap, NOT box overlap.** Verified on real data:
  - Two ~1bp SNPs at distinct sub-pixel positions **never collide** under
    `pitchX:1`. Their truncated pixel intervals (`Math.trunc(px)`, +1 padding in
    `LayoutRow`) only *touch*, never overlap — the collision test `start < pRight`
    fails when `pRight === pLeft`. So with `showLabels:false`, real volvox variants
    at `bpPerPx=100` produced **0** stacked rows even *without* the fix.
  - With `showLabels:true`, each variant reserves its name-label width (`packRef`
    widens `layoutEndBp` by `maxLabelWidthPx * bpPerPx`, ~40px). Neighbours within
    that span now overlap → stack. This is exactly what commit `5c806c3cff`
    ("pitchX:1 so sub-10px label spans stack rows") made precise for genes, and it
    regressed variant collapse as a side effect.
  - The fix gates on **box width**, not the label-padded layout span, so a
    sub-pixel box collapses to row 0 *regardless of its label*. That's why it works
    for the label-overhang case even though the trigger is the label.
  - (Box-adjacency stacking also exists but only for ~1–2px-wide boxes at
    near-base-level zoom, where the +1px padding bridges abutting boxes. The fix
    covers that too. It is the minor case; label overhang is the real-world one.)

## Verification done / not done

- **Done — real-data pipeline drive** (temp harness, since deleted): 25 real
  `volvox.filtered.vcf.gz` ctgA variants through the actual
  `findGlyph → collectRenderData → computeLaidOutData`:
  - 25/25 classify as `Box` → 25/25 get `densityFade=true`.
  - `bpPerPx=100`, labels on: **baseline 19/25 stacked** (topPx up to 180) →
    **fix 0/25 stacked**.
- **NOT done — browser/GPU pixel render.** jbrowse-web won't build in the shared
  tree: a concurrent agent's `plugins/tview/` + `corePlugins.ts`/`package.json`
  changes pull in `react-msaview`, whose `tss-react/mui` dep is unresolvable
  (`Cannot find module 'tss-react/mui'`, webpack emits no bundle). Unrelated to
  this change and not safely fixable without touching their files.
  - **When the tree builds again**, drive it with puppeteer: session-spec URL
    `?config=test_data/volvox/config.json&session=spec-<encoded>` where the session
    is `{views:[{type:'LinearGenomeView',assembly:'volvox',loc:'ctgA:1-50000',tracks:['volvox_test_vcf']}]}`;
    read `window.JBrowseSession.views[0].tracks[0].displays[0].laidOutDataMap` and
    assert every `flatbushItems[].topPx === 0` at a sub-pixel zoom with labels on.
    Chrome flags: `--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`.
    Harness primitives live in `@jbrowse/browser-test-utils`.

## Open edge case (by design, un-eyeballed)

Collapsed boxes are pinned to row 0 **and kept out of the collision bitmap**, so
in a **mixed** track (sub-pixel SNPs + a wide SV that doesn't collapse at that
zoom) the SV can land on row 0 *over* the collapsed density row instead of
stacking above it. Correct for a pure variant track (one clean row); for mixed
tracks it's a behavior choice never visually checked. If it looks wrong, the
alternative is to add collapsed boxes to the bitmap at row 0 so real features
stack above them.
