---
name: WebGL/WebGPU Migration
description:
  Active migration to GPU-accelerated rendering with three backends (WebGPU,
  WebGL2, Canvas 2D). Tracks progress on PRD items.
type: project
---

Branch: `webgl-poc`, PRD at repo root `/PRD.md`

## Completed (as of 2026-03-19)

- **P1.1 Canvas 2D Fallback**: All 10 track types have Canvas 2D fallback
  renderers
- **P1.2 Data Fetching**: Replaced legacy `staticRegions` with viewport-based
  `mergedVisibleRegions` + 50% buffer; integrated `isCacheValid()` for wiggle
  resolution re-fetch; error recovery on zoom
- **P1.4 Session Migration**: Snapshot migration for old display types and
  property names — `migrateWiggleSnapshot`, `migrateAlignmentsSnapshot`,
  `migrateSessionSnapshot`/`migrateConfigSnapshot` (49 tests total). Wired into
  session loading and config loading paths.
- **P2.1 Alignments**: Mapping quality legend, outline when compact, arc alpha
  fix, linked read snapshot migration
- **P2.2 Wiggle**: Cross-hatches (displayCrossHatches toggle + SVG overlay)
- **Effective Track Config**: `effectiveTrackConfig` getter on displays bakes
  session overrides into track config snapshots for "Copy config" in About
  track dialog (14 tests)
- **Tests**: 63+ new tests across 5 suites

## Architecture: Config Override Pattern

Display models have `*Setting` properties (e.g., `colorSetting`) that override
config slots. Getters merge them: `get color() { return self.colorSetting ??
getConf(self, 'color') }`. The `effectiveTrackConfig` getter iterates config
slots and compares against display getters to produce a config snapshot with
overrides baked in. Plan to simplify this in `CONFIG_SIMPLIFICATION.md`.

## Next Priority Items

- P2.3: Hs1 vs mm39 synteny excessively slow
- P3.1: Closing track errors (getContainingView throws on detached model)
- P1.3: Expand browser test suite
- Add `effectiveTrackConfig` override to remaining display types

**Why:** These are the highest-impact remaining issues per PRD analysis. **How
to apply:** Check PRD.md for full item list and demo inventory status.
