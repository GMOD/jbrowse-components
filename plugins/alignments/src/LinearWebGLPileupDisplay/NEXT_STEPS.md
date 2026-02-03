# WebGL Pileup Display - Next Steps

## Current State (as of this session)

The WebGL pileup display is functional and renders BAM reads as colored rectangles with smooth zoom/pan. It's set as the default display for alignments tracks.

### What's Working
- GPU-accelerated rendering with instanced drawing
- Color schemes: strand, MAPQ, insert size, first-of-pair
- Smooth zoom (wheel) and pan (drag)
- Syncs to LinearGenomeView so other tracks follow
- Data prefetching with 2x buffer
- Refname aliasing (chr1 vs 1)
- Works inside LinearAlignmentsDisplay composite
- **Coverage track** - Integrated coverage histogram at top of display
  - Computed from loaded reads using sweep line algorithm
  - Binned for efficiency (max 10000 bins)
  - Shows strand coloring when pileup is colored by strand
  - Toggle via track menu "Show/Hide coverage"
  - Visual separator line between coverage and pileup

### Key Files
- `model.ts` - MST state model with `fetchFeatures` using `flow()`, `getAdapter()`, `renameRegionsIfNeeded()`, `coverageData` computed view
- `components/WebGLPileupComponent.tsx` - React component, local state for smooth interaction, throttled sync to LGV, coverage upload
- `components/WebGLRenderer.ts` - WebGL2 with instanced rendering, shaders for read rectangles and coverage bars

## Immediate Next Steps

### 1. Add CIGAR Features (Deletions/Insertions)

Reference implementation exists in `plugins/alignments/webgl-poc/with-cigar.html`.

In `model.ts`, update `fetchFeatures` to extract CIGAR data:
```typescript
// Inside the feature.subscribe callback, extract:
const mismatches = feature.get('mismatches') // Array of {type, start, length, base}
// Filter by type: 'deletion', 'insertion', 'mismatch', 'softclip'
```

In `WebGLRenderer.ts`, add:
- Gap shader program (dark rectangles for deletions)
- Mismatch shader program (colored squares for SNPs)
- Insertion markers (small triangles)

Multi-pass rendering order:
1. Read rectangles (main pass)
2. Gaps/deletions (dark lines over reads)
3. Mismatches (colored by base A/C/G/T)
4. Insertions (purple triangles)

### 2. Add Feature Interaction (Click/Hover)

Options:
a) **Color picking** - Render feature IDs to offscreen buffer, read pixel on click
b) **CPU hit testing** - Store feature bounds, test mouse position against them

For (b), in `WebGLPileupComponent.tsx`:
```typescript
const handleClick = (e: React.MouseEvent) => {
  const rect = canvasRef.current.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // Convert to genomic coords
  const bp = domain[0] + (x / width) * (domain[1] - domain[0])
  const row = Math.floor((y + localRangeY[0]) / (featureHeight + featureSpacing))

  // Find feature at this position (need to store layout info)
  const feature = findFeatureAt(bp, row)
  if (feature) {
    // Show tooltip or open feature detail widget
  }
}
```

### 3. Clean Up Debug Logging

Remove `console.log` statements in:
- `model.ts`: lines ~123, 239, 251, 253, 263, 297, 308
- `WebGLPileupComponent.tsx`: lines ~109, 126, 134

### 4. Vertical Scrollbar

Add a scrollbar component or integrate with existing JBrowse scrollbar. Currently only shift+wheel scrolls vertically.

## Architecture Notes

### Why Local State + Sync Back
The WebGL component maintains `localDomain` in React state for immediate updates during interaction. This bypasses mobx reactions which would cause lag. After interaction, it syncs back to LGV via `view.navTo()`.

The `syncingRef` flag prevents feedback loops - when we update the LGV, we ignore the resulting mobx reaction.

### Why `flow()` for fetchFeatures
MST requires `flow()` with generator functions for async actions that modify state after `await`. Regular async/await loses the action context.

### Adapter Access
```typescript
const { pluginManager } = getEnv(self)
const session = getSession(self)
const adapterConfig = getConf(track, 'adapter')

const { dataAdapter } = await getAdapter(pluginManager, session.id, adapterConfig)
```

### Refname Renaming
```typescript
const { regions: renamedRegions } = await renameRegionsIfNeeded(
  session.assemblyManager,
  { regions: [region], adapterConfig, sessionId: session.id }
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
- Architecture doc: `plugins/alignments/webgl-poc/persistent-webgl-architecture.md`
- Original pileup (feature parity reference): `plugins/alignments/src/LinearPileupDisplay/`
- Mismatch types: `plugins/alignments/src/shared/types.ts` (SNPMismatch, DeletionMismatch, etc.)
