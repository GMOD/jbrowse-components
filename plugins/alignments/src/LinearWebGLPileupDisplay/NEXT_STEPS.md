# WebGL Pileup Display - Next Steps

## Current State (as of this session)

The WebGL pileup display is functional and renders BAM reads as colored
rectangles with smooth zoom/pan. It's set as the default display for alignments
tracks.

### What's Working

- GPU-accelerated rendering with instanced drawing
- Color schemes: strand, MAPQ, insert size, first-of-pair
- **Smooth zoom (wheel) and pan (drag)** - Uses ViewCoordinator for instant sync
  across multiple canvases
- Syncs to LinearGenomeView so other tracks follow (debounced to avoid stutter)
- Data prefetching with 2x buffer
- Refname aliasing (chr1 vs 1)
- Works inside LinearAlignmentsDisplay composite
- **Coverage track** - Integrated coverage histogram at top of display
  - Computed from loaded reads using sweep line algorithm
  - Binned for efficiency (max 10000 bins)
  - Shows strand coloring when pileup is colored by strand
  - Toggle via track menu "Show/Hide coverage"
  - Visual separator line between coverage and pileup
- **Multi-canvas synchronization** - ViewCoordinator broadcasts position changes
  instantly
- **Bounds checking** - offsetPx clamped to valid range
- **Multi-region support** - Uses view.pxToBp() for coordinate conversion

### Key Files

- `model.ts` - MST state model with `fetchFeatures` using `flow()`,
  `getAdapter()`, `renameRegionsIfNeeded()`, `coverageData` computed view, CIGAR
  data extraction (GapData, MismatchData, InsertionData)
- `components/WebGLPileupComponent.tsx` - React component, local refs for smooth
  interaction, ViewCoordinator for multi-canvas sync
- `components/WebGLRenderer.ts` - WebGL2 with instanced rendering, shaders for
  read rectangles, coverage bars, gaps, mismatches, and insertions
- `components/ViewCoordinator.ts` - Broadcasts position changes instantly
  between canvases, bypassing mobx

## Immediate Next Steps

### 1. ✅ CIGAR Features (Deletions/Insertions/Mismatches)

Implemented! The WebGL display now renders:

- **Gaps** (deletions/skips) - Dark rectangles drawn over read rows
- **Mismatches** (SNPs) - Colored by base (A=green, C=blue, G=orange, T=red)
- **Insertions** - Purple triangle markers

The adapter already parses CIGAR and provides `feature.get('mismatches')`. We
extract this during `fetchFeatures` and upload to GPU.

Toggle via track menu "Show/Hide mismatches".

Visibility thresholds (to avoid clutter at zoomed-out levels):

- Gaps: Always visible
- Mismatches: Only when bp/px < 50
- Insertions: Only when bp/px < 100

### 2. Add Feature Interaction (Click/Hover)

Options: a) **Color picking** - Render feature IDs to offscreen buffer, read
pixel on click b) **CPU hit testing** - Store feature bounds, test mouse
position against them

For (b), in `WebGLPileupComponent.tsx`:

```typescript
const handleClick = (e: React.MouseEvent) => {
  const rect = canvasRef.current.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // Convert to genomic coords
  const bp = domain[0] + (x / width) * (domain[1] - domain[0])
  const row = Math.floor(
    (y + localRangeY[0]) / (featureHeight + featureSpacing),
  )

  // Find feature at this position (need to store layout info)
  const feature = findFeatureAt(bp, row)
  if (feature) {
    // Show tooltip or open feature detail widget
  }
}
```

### 3. Clean Up Debug Logging

✅ Done - Console.log statements removed from model.ts and component.

### 4. Vertical Scrollbar

Add a scrollbar component or integrate with existing JBrowse scrollbar.
Currently only shift+wheel scrolls vertically.

## Architecture Notes

### Smooth Zoom/Pan Architecture

The WebGL component maintains local refs (`offsetPxRef`, `bpPerPxRef`) for
immediate rendering during interaction. This completely bypasses mobx reactions
which would cause lag.

**ViewCoordinator** handles instant synchronization between multiple WebGL
canvases:

1. When user interacts with Canvas A, it updates local refs and calls
   `renderImmediate()`
2. Canvas A broadcasts position to ViewCoordinator
3. ViewCoordinator notifies all other canvases synchronously (same JS event
   loop)
4. Other canvases update their refs and call `renderImmediate()`
5. All canvases render in the same frame

**Debounced sync to mobx** (`debouncedSyncToView`) updates the view's actual
position after 100ms of idle. This updates:

- URL
- Non-WebGL tracks
- Other UI elements

The `interactingRef` flag prevents feedback loops - when interacting, we ignore
incoming mobx changes.

### Why `flow()` for fetchFeatures

MST requires `flow()` with generator functions for async actions that modify
state after `await`. Regular async/await loses the action context.

### Adapter Access

```typescript
const { pluginManager } = getEnv(self)
const session = getSession(self)
const adapterConfig = getConf(track, 'adapter')

const { dataAdapter } = await getAdapter(
  pluginManager,
  session.id,
  adapterConfig,
)
```

### Refname Renaming

```typescript
const { regions: renamedRegions } = await renameRegionsIfNeeded(
  session.assemblyManager,
  { regions: [region], adapterConfig, sessionId: session.id },
)
```

## Compatibility Methods

The model includes stub methods for `LinearAlignmentsDisplay` compatibility:

- `setConfig()` - no-op
- `setFeatureDensityStatsLimit()` - no-op
- `getFeatureByID()` - returns undefined
- `searchFeatureByID()` - returns undefined
- `featureIdUnderMouse` - returns undefined
- `features` - returns empty Map
- `sortedBy` - returns undefined

These will need real implementations for full feature parity.

## Performance Considerations

- Current approach uploads all features in region to GPU
- For very high coverage (>50k reads), consider:
  - Downsampling at zoomed-out levels
  - Showing coverage instead of individual reads
  - Chunked uploading
- GPU memory usage: ~60 bytes per read (positions, y, flags, mapq, insertSize)

## Reference Code

- Full CIGAR POC: `plugins/alignments/webgl-poc/with-cigar.html`
- Architecture doc:
  `plugins/alignments/webgl-poc/persistent-webgl-architecture.md`
- Original pileup (feature parity reference):
  `plugins/alignments/src/LinearPileupDisplay/`
- Mismatch types: `plugins/alignments/src/shared/types.ts` (SNPMismatch,
  DeletionMismatch, etc.)
