# WebGL/WebGPU Migration — Project Requirements

**Branch:** `webgl-poc` | **Updated:** 2026-04-14 | **Status:** Active  
Move completed items to `agent-docs/completed/COMPLETED.md`.

---

## Overview

Migrating JBrowse 2 from block-based HTML canvas to GPU-accelerated pipeline.
Three backends: **WebGPU**, **WebGL 2.0**, **HTML5 Canvas** (fallback + SVG).
Most track types working; known bugs/gaps below.

---

## Priority 1 — Critical / Blocking

### P1.3 WebGPU CI Testing

Not running on CI. Chrome flags in `runner.ts` but Vulkan missing.

| Approach | Cost | Setup |
| --- | --- | --- |
| Lavapipe | 0 | `apt-get install mesa-vulkan-drivers`, set `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json`, run under `xvfb-run` |
| macOS | 10× | Real GPU available |

**Local**: Firefox headed mode with real GPU — `--backend=webgpu --firefox --headed`. See TEST_INFRASTRUCTURE.md.

### P1.4 Config Migration: PileupRenderer → display-level

Old configs with `configuration.renderer.type === 'PileupRenderer'` silently lose
settings (`featureHeight`, `featureSpacing`, `maxHeight`, `colorBy`, `filterBy`).

**Missing**: `migrateDisplayConfiguration()` to hoist renderer → display-level
properties in both session and config migration.

**Steps**:
1. In `migrateSessionSnapshot.ts`, add `migrateDisplayConfiguration(display)`
2. Detect `type === 'PileupRenderer'`, hoist properties, remove `renderer` slot
3. Wire into `migrateTrackSnapshot`

**No migration needed**: `CanvasFeatureRenderer`, `SvgFeatureRenderer`,
`ArcRenderer`, `LollipopRenderer` still have valid renderer slots.

**Verify**: `config_demo.json`, `volvox/config.json` load with JEXL color
expressions intact.

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
