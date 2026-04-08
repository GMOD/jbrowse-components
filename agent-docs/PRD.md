# JBrowse 2 WebGL/WebGPU Migration — Project Requirements Document

**Branch:** `webgl-poc` **Last updated:** 2026-04-08 **Status:** Active
development — many features working, significant polish and testing needed

> **Note:** When items are completed, move them to `agent-docs/completed/COMPLETED.md`.

---

## Executive Summary

JBrowse 2 is being migrated from its block-based HTML canvas rendering to a
unified GPU-accelerated rendering pipeline supporting three backends:
**WebGPU**, **WebGL 2.0**, and **HTML5 Canvas** (fallback + SVG export). The
branch has working implementations for most track types with known bugs and gaps
documented below.

---

## Priority 1 — Critical / Blocking

### P1.3 WebGPU CI Testing

CI already runs Canvas 2D and WebGL passes on `ubuntu-latest`. WebGPU is not
yet run on CI. `runner.ts` already has the Chrome flags for WebGPU, but Vulkan
is not installed on the runner.

**Local:** Firefox headed mode with a real GPU works for WebGPU — use
`--backend=webgpu --firefox --headed`. See `TEST_INFRASTRUCTURE.md`.

**CI options:**
- Install `mesa-vulkan-drivers` (lavapipe — software Vulkan), set
  `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json`, run under `xvfb-run`.
  Zero extra runner cost; flags already scaffolded in `runner.ts`.
- Use `macos-latest` runner (real GPU, confirmed by Bevy project) — ~10×
  runner cost.

### P1.4 Old Config / Session Migration

Old user configs and shared session links can break silently because this branch
removed the `PileupRenderer` entirely — `LinearAlignmentsDisplay` no longer has
a `renderer` config slot. Alignments tracks that had custom renderer settings
(e.g. `featureHeight`, `featureSpacing`, `maxHeight`, `colorBy`, `filterBy`
stored under `configuration.renderer`) will load with defaults instead.

**What already exists:**
- `migrateSessionSnapshot` / `migrateConfigSnapshot` in
  `products/jbrowse-web/src/migrateSessionSnapshot.ts` — rewrites old display
  type names (LinearPileupDisplay → LinearAlignmentsDisplay, etc.) but does NOT
  migrate `configuration.renderer` properties
- `migrateAlignmentsSnapshot` (via `preProcessSnapshot` in
  `LinearAlignmentsDisplay/model.ts`) — migrates display *state* properties
  (renderingMode, showReadCloud, PileupDisplay/SNPCoverageDisplay nesting, etc.)
  but also does NOT touch `configuration`

**Gap:** `configuration.renderer` hoisting. Old configs look like:
```json
{ "configuration": { "renderer": { "type": "PileupRenderer", "featureHeight": 10 } } }
```
The renderer slot is gone; those values are silently dropped.

**Action plan:**
- Add a `migrateDisplayConfiguration(display)` helper in
  `migrateSessionSnapshot.ts` that checks for `configuration.renderer.type ===
  'PileupRenderer'` and hoists `featureHeight`, `featureSpacing`, `maxHeight`,
  `colorBy`, `filterBy` up to `configuration`, then removes `renderer`
- Wire it into `migrateTrackSnapshot` (already walks all display configs) — both
  the config and session paths go through this
- Other renderer types (`CanvasFeatureRenderer`, `SvgFeatureRenderer`,
  `ArcRenderer`, `LollipopRenderer`) still have valid `renderer` slots in their
  display configSchemas and do not need migration

**Verification:** Our own `config_demo.json` and `volvox/config.json` actively
use `CanvasFeatureRenderer`/`SvgFeatureRenderer`/`ArcRenderer` renderer configs
with JEXL color expressions — verify these still load correctly after the change.

---

## Architecture Notes

```
┌─────────────────────────────────────────────┐
│            Track Display Model              │
│         (prepares data, layout)             │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌────────┐  ┌────────┐  ┌────────────┐
│ WebGPU │  │WebGL2  │  │ Canvas 2D  │ ← COMPLETE (all track types)
│ (WGSL) │  │(GLSL)  │  │ (fallback) │
└────────┘  └────────┘  └────────────┘
                              │
                         ┌────┴────┐
                         ▼         ▼
                    ┌────────┐ ┌───────┐
                    │ Screen │ │  SVG  │ (via SvgCanvas.ts)
                    └────────┘ │Export │
                               └───────┘
```

Backend override: `?gpu=webgpu` / `?gpu=webgl` / `?gpu=off`

Default: auto-detect (WebGPU → WebGL2 → Canvas 2D)
