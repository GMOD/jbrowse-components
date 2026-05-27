# LinearArcDisplay: drop the renderer

## Goal

Remove `plugins/arc/src/ArcRenderer/` (legacy `FeatureRendererType` pluggable
element) and run `LinearArcDisplay` through the same direct fetch + SVG path
that `LinearPairedArcDisplay` already uses. Part of the broader "renderer
concept goes away with the webgl refactor" cleanup. MAF was cleared in the
same session — see `plugins/maf/src/index.ts` and the now-empty
`LinearMafDisplay/configSchema.ts` for the pattern when the display has no
React component beyond GPU; arc keeps an SVG component so the shape is
slightly different.

## Chosen approach: whole-view fetch

Confirmed direction from the prior session: **whole-view fetch**, mirroring
`LinearPairedArcDisplay`. Single `CoreGetFeatures` RPC per autorun over
`view.staticBlocks.contentBlocks`, render all arcs in one SVG via an observer
component.

Behavior note: this is a real change from current per-block rendering. Arcs
that span blocks will draw cleanly across them (improvement), but the fetch
isn't throttled per-block. If the adapter is large, may need to keep the
`renderDelay: 500` semantics by wrapping the autorun in a `delay: 500` (which
PairedArc already does — see `LinearPairedArcDisplay/afterAttach.tsx:21`).

Reject the alternative ("keep block-based, inline rendering"): more code,
preserves throttling but bypasses CoreRender without giving us anything we
couldn't get cheaper from PairedArc's pattern + density mixin gating.

## Template files to copy from

| Concern             | Template                                                                              |
| ------------------- | ------------------------------------------------------------------------------------- |
| State model shape   | `plugins/arc/src/LinearPairedArcDisplay/model.ts`                                     |
| Fetch RPC call      | `plugins/arc/src/LinearPairedArcDisplay/fetchChains.ts`                               |
| afterAttach autorun | `plugins/arc/src/LinearPairedArcDisplay/afterAttach.tsx`                              |
| SVG render          | `plugins/arc/src/LinearPairedArcDisplay/components/Arcs.tsx`                          |
| Display ReactComp   | `plugins/arc/src/LinearPairedArcDisplay/components/ReactComponent.tsx`                |
| Density gating      | `FeatureDensityMixin` import + `featureDensityStatsReadyAndRegionNotTooLarge` gate    |

`ArcRendering.tsx` already takes `features: Map`, `config`, `regions`,
`bpPerPx`, `height`, `displayMode` — it's reusable as the per-region inner
renderer if we want, but PairedArc's flatter `Arcs.tsx` (one SVG, iterate
features) is probably the better target.

## Step plan

1. **Inline ArcRenderer's config slots into `LinearArcDisplay/configSchema.ts`**
   — copy `color`, `thickness`, `label`, `height`, `caption`, `displayMode`
   from `plugins/arc/src/ArcRenderer/configSchema.ts:9-69`. Drop the
   `renderer: types.optional(pluginManager.pluggableConfigSchemaType('renderer'), ...)`
   slot from the display config.

2. **Rewrite `LinearArcDisplay/model.ts`** following PairedArc:
   - Compose `BaseDisplay + TrackHeightMixin + FeatureDensityMixin` (drop
     `BaseLinearDisplay` — block-based is no longer needed)
   - Add volatile `features: Feature[] | undefined`, `loading: boolean`
   - Add `setFeatures`, `setLoading`, `setDisplayMode` actions
   - `afterAttach` autorun → `fetchArcs(self)`
   - Drop `rendererTypeName`, `rendererConfig`, `renderProps`,
     `blockType`, `renderDelay` getters
   - `displayModeSetting` reads from the display config now, not
     `getConf(self, ['renderer', 'displayMode'])`

3. **Create `LinearArcDisplay/fetchArcs.ts`** — copy `fetchChains.ts`
   verbatim, rename to `fetchArcs`. RPC payload is identical.

4. **Create `LinearArcDisplay/afterAttach.tsx`** — identical to PairedArc's,
   call `fetchArcs` instead.

5. **Create `LinearArcDisplay/components/Arcs.tsx`** — start from PairedArc's
   `Arcs.tsx`, but use single-feature arcs (no ALT/paired split) and pull
   semicircle/bezier path logic from the existing
   `ArcRenderer/ArcRendering.tsx:25-49` (`getSemicirclePath`,
   `getBezierPath`). Keep the `ArcTooltip` lazy import.

6. **Create `LinearArcDisplay/components/ReactComponent.tsx`** — observer
   wrapping `<BaseDisplayComponent><Arcs /></BaseDisplayComponent>`. (Look
   at `LinearPairedArcDisplay/components/BaseDisplayComponent.tsx` —
   PairedArc inlined a small wrapper there; we can probably reuse it or
   import from PairedArc.)

7. **Update `LinearArcDisplay/index.ts`** — swap
   `ReactComponent: BaseLinearDisplayComponent` for the new component.

8. **Delete `plugins/arc/src/ArcRenderer/` entirely** — directory plus its
   `ArcRendererF` registration in `plugins/arc/src/index.ts`. Also delete
   `ArcRenderer/ArcRendering.test.tsx` and its snapshot (the test renders
   the renderer in isolation; if we want UI coverage for the new component,
   add a fresh test that mounts the display).

9. **Verify**:
   - `npx tsgo --noEmit -p plugins/arc/tsconfig.build.esm.json`
   - `pnpm test plugins/arc`
   - Browser smoke: load a small arc track (e.g. the demo config that
     currently uses `LinearArcDisplay`), verify arcs render in both `arcs`
     and `semicircles` modes, tooltip shows, color/thickness slots respond
     to config edits.

## Pitfalls

- **`displayMode` config path**: `LinearPairedArcDisplay/model.ts:60` still
  does `getConf(self, ['renderer', 'displayMode'])`, which is a stale
  reference now that PairedArc has no `renderer` slot in its config. That's
  a latent bug in PairedArc — worth fixing as part of this work so the new
  LinearArcDisplay model.ts doesn't copy it. Correct read after migration:
  `self.displayMode ?? getConf(self, 'displayMode')`.
- **Existing session JSON**: any saved config blob with
  `{ type: 'LinearArcDisplay', renderer: { type: 'ArcRenderer', ... } }`
  will have a stray `renderer` key after the slot is dropped. MST should
  silently drop unknown keys on load, but spot-check with a real saved
  session.
- **Snapshot test**: `plugins/arc/src/ArcRenderer/__snapshots__/ArcRendering.test.tsx.snap`
  goes away with the renderer. Don't try to port it — the new component
  has a different prop shape; write a fresh test or skip UI coverage.

## Related cleanup (defer to a separate pass)

`plugins/linear-genome-view/src/LinearBareDisplay/model.ts:42-56` is the
other consumer of `rendererTypeName`/`rendererConfig` going through the live
CoreRender path. Same shape of migration, different display. Once both are
done, `rendererTypeName: ''` default in
`packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx:39`
plus the `rendererType` getter on line 168 can be removed, and
`CoreRender` / `CoreGetFeatureDetails` in `RpcRegistry.ts:85-92` can be
tightened off `Record<string, unknown>` or deleted entirely.
