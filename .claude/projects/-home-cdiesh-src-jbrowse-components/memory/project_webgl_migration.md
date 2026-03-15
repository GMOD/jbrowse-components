---
name: WebGL/WebGPU Migration
description:
  Active migration to GPU-accelerated rendering with three backends (WebGPU,
  WebGL2, Canvas 2D). Tracks progress on PRD items.
type: project
---

Branch: `webgl-poc`, PRD at repo root `/PRD.md`

## Completed (as of 2026-03-14)

- **P1.1 Canvas 2D Fallback**: All 10 track types have Canvas 2D fallback
  renderers
- **P1.2 Data Fetching**: Replaced legacy `staticRegions` with viewport-based
  `mergedVisibleRegions` + 50% buffer; integrated `isCacheValid()` for wiggle
  resolution re-fetch; error recovery on zoom
- **P2.1 Alignments**: Mapping quality legend, outline when compact (2px
  threshold), arc premultiplied alpha fix, mouseover reset on linked read
  toggle, linked read snapshot migration
- **P2.2 Wiggle**: Cross-hatches (displayCrossHatches toggle + SVG overlay)
- **Tests**: 173 tests across 18 suites (Canvas2D renderers, fetch autorun
  logic, MobX integration, browser tests)

## Architecture: Data Fetching

- Fetch autorun in `MultiRegionDisplayMixin` uses `view.mergedVisibleRegions`
  (exact viewport from dynamicBlocks)
- Checks visible coverage against `loadedRegions` (WHEN to fetch)
- Adds 50% viewport buffer when fetching (WHAT to fetch), clamped to
  displayedRegion boundaries
- `isCacheValid()` prevents stale resolution data (wiggle: re-fetches when
  zoomed in >2x)
- Error and regionTooLarge cleared on zoom change
- `staticBlocks` kept for UI only (scalebar, gridlines, ref name labels)

## Next Priority Items

- P1.2: Force load threshold too aggressive (canvas maxFeatureCount=5000)
- P2.1: Force load stuck on pan (only clears on zoom, not on pan)
- P2.3: Hs1 vs mm39 synteny excessively slow
- P2.1: Color by tag timing issue (colorTagMap empty on first fetch)

**Why:** These are the highest-impact remaining issues per PRD analysis. **How
to apply:** Check PRD.md for full item list and demo inventory status.
