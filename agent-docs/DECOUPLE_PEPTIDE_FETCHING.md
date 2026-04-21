**Decouple amino-acid overlay loading**, treat density gate as one-shot →
drop canvas `isCacheValid` entirely. See implementation plan below.

---

## Amino-acid overlay decoupling — implementation plan

Goal: make the amino-acid overlay a separate lazy fetch so crossing the
`shouldRenderPeptideBackground` threshold (1 bpPerPx) no longer invalidates
the main feature cache and triggers a full region refetch.

**Step 1 — Extract `buildAminoAcidOverlay` from `collectRenderData`.**
The peptide overlay items are currently built inside `collectRenderData` as a
side-effect of processing each transcript (`collectRenderData.ts:231–283`,
writing into `collector.aminoAcidOverlay`). Pull that logic into a standalone
`buildAminoAcidOverlay(layouts, peptideDataMap, config, theme, regionStart):
AminoAcidOverlayItem[]` function in the peptides directory so it can be called
independently.

**Step 2 — Add `FetchPeptideOverlay` RPC.**
New worker entry point (mirroring the structure of `executeRenderFeatureData`)
that: fetches features for the region, builds layouts via `layoutFeature`,
calls `fetchPeptideData`, then calls `buildAminoAcidOverlay`. Returns
`AminoAcidOverlayItem[]`. Register alongside `RenderFeatureData` in
`canvasRpcMethods.ts`. Note: this re-fetches features from the adapter, but
the adapter's in-memory cache means no extra network round-trips for most
sources.

**Step 3 — Remove peptide fetch from main RPC.**
In `executeRenderFeatureData`: delete the `peptideDataMap` block (lines
132–148). Pass `undefined` for `peptideDataMap` in the `collectRenderData`
call. Drop `aminoAcidOverlay` from `FeatureDataResult` and `rpcTypes.ts`.
`collectRenderData` still accepts optional `peptideDataMap` (now always
undefined from the main path) — clean it up or leave for now.

**Step 4 — Add `peptideOverlayMap` volatile to canvas model.**
In `baseModel.ts`: add `peptideOverlayMap: observable.map<number,
AminoAcidOverlayItem[]>()` as a volatile. Add a second autorun (alongside the
existing fetch autorun) that watches `shouldRenderPeptideBackground(view.bpPerPx)`
and `colorByCDS`:
- When above threshold: clear `peptideOverlayMap`.
- When below threshold: for each `displayedRegionIndex` present in `rpcDataMap`
  but absent from `peptideOverlayMap`, call `FetchPeptideOverlay` and store the
  result. This is the "one-shot" — already-loaded regions skip the fetch.

**Step 5 — Wire overlay into `computeLaidOutData`.**
In `layout.ts`, `computeLaidOutData` currently reads `raw.aminoAcidOverlay` from
the RPC result and adjusts `topPx` via `featureOffsets[aa.flatbushIdx]`. Change
it to read from `self.peptideOverlayMap.get(displayedRegionIndex)` instead.
The `featureOffsets` adjustment stays the same.

**Step 6 — Update SVG renderer.**
`renderSvg.tsx` reads `data.aminoAcidOverlay` from the per-region data object.
Plumb the overlay in as a separate argument sourced from `peptideOverlayMap`.

**Step 7 — Drop canvas `isCacheValid`.**
Remove the override from `baseModel.ts` (lines 626–636). Canvas now uses the
base-class default (`() => true`). Update `CLAUDE.md` and
`agent-docs/ARCHITECTURE.md` to remove the canvas exception from the
"Per-region zoom-staleness" section.

**Step 8 — Clean up types and tests.**
Remove `aminoAcidOverlay` from `FeatureDataResult`. Update `fetchAutorun.test.ts`
if any canvas-specific `isCacheValid` tests existed. Add a unit test for the new
autorun: loads a region, zooms past threshold, verifies `FetchPeptideOverlay`
was called once and result cached; zooms back out, verifies map cleared; zooms
in again, verifies called again.
