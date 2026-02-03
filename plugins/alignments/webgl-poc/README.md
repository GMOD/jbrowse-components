# WebGL Pileup Renderer Proof of Concept

This directory contains proof-of-concept implementations demonstrating how WebGL could enable smooth zoom/pan for alignment rendering without re-fetching or re-processing data.

## Files

- **`index.html`** - Basic version with colored read rectangles
- **`with-cigar.html`** - Extended version with CIGAR gaps (deletions), mismatches, and insertions

## How to Run

```bash
# From this directory
npx serve .
# Then open http://localhost:3000/index.html or http://localhost:3000/with-cigar.html

# Or simply open the HTML files directly in a browser
```

## Key Concepts Demonstrated

### 1. Upload Once, Transform on GPU

Data is converted to GPU buffers **once** when loaded:
- Read positions (x1, x2) as Float32Array
- Y positions from pileup layout
- Strand, MAPQ, insert size for coloring

On every frame, **only uniforms change**:
- `u_domainX`: Current genomic range [start, end]
- `u_rangeY`: Current Y scroll position
- `u_colorScheme`: Which coloring mode

The vertex shader transforms genomic coordinates to screen space:

```glsl
float domainWidth = u_domainX.y - u_domainX.x;
float screenX = (genomicX - u_domainX.x) / domainWidth * 2.0 - 1.0;
```

### 2. Instanced Rendering

Each read is one "instance" that generates 6 vertices (2 triangles for a quad). This means:
- 10,000 reads = 10,000 instances = 60,000 vertices
- But only 10,000 * 6 floats = 240KB of attribute data
- GPU generates the per-vertex positions from per-instance data

```javascript
gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, readCount);
```

### 3. Color Scheme Changes Are Free

Colors are computed in the vertex shader based on read attributes + `u_colorScheme` uniform:

```glsl
if (u_colorScheme == 0) color = strandColor(a_strand);
else if (u_colorScheme == 1) color = mapqColor(a_mapq);
else color = insertSizeColor(a_insertSize);
```

Changing the dropdown updates `u_colorScheme` and re-renders - no data changes.

### 4. Level-of-Detail (LOD)

Mismatches and insertions are only rendered when zoomed in:

```javascript
if (bpPerPx < 50) {
  // Draw mismatches
}
if (bpPerPx < 100) {
  // Draw insertions
}
```

This could be extended to:
- Show only coverage at very zoomed out levels
- Show simplified read shapes at medium zoom
- Show full per-base detail when zoomed in

### 5. Multi-Pass Rendering

Different features use different shader programs:
1. **Reads** - Main read rectangles with coloring
2. **Gaps** - Dark lines for deletions (drawn on top of reads)
3. **Mismatches** - Colored squares for SNPs
4. **Insertions** - Triangle markers

Each pass uses the same uniforms (domainX, rangeY) but different geometry.

## Performance Characteristics

On a typical laptop:
- **10,000 reads**: 60 FPS smooth zoom/pan
- **50,000 reads**: Still interactive
- **Upload time**: ~5-20ms for 10K reads
- **Frame time**: <2ms (mostly GPU-bound)

Compare to Canvas 2D:
- Every zoom/pan requires re-iterating all features in JS
- Color changes require full re-render with new colors
- Performance degrades linearly with feature count

## Architecture for JBrowse Integration

```
┌─────────────────────────────────────────────────────────────┐
│  BamAdapter.getFeatures()                                   │
│  - Fetches reads for region + buffer                        │
│  - Returns stream of features                               │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  WebGLPileupRenderer                                        │
│  1. Collect features into arrays                            │
│  2. Run CPU pileup layout (assign Y positions)              │
│  3. Upload to GPU buffers (once per region change)          │
│  4. On zoom/pan: update uniforms only                       │
│  5. On color change: update colorScheme uniform             │
└─────────────────────────────────────────────────────────────┘
```

### When to Re-Upload

Data must be re-uploaded when:
- User scrolls to a completely new region
- Filter settings change (need different features)
- Sort order changes (Y positions change)

Data does NOT need re-upload when:
- Zoom in/out within current region
- Pan within current region
- Color scheme changes
- Display settings change (hide/show mismatches, etc.)

### Memory Estimate for Real Data

For 100,000 reads (typical high-coverage view):
- Positions: 100K * 2 * 4 bytes = 800 KB
- Y coords: 100K * 4 bytes = 400 KB
- Strand/MAPQ/etc: 100K * 4 * 4 bytes = 1.6 MB
- Mismatches (~3 per read): 300K * 3 * 4 bytes = 3.6 MB
- **Total: ~6-7 MB GPU memory**

This is very manageable - GPUs typically have 1-8+ GB of memory.

## Next Steps for Production

1. **Add CIGAR-driven shapes**: Render soft clips, handle complex CIGAR patterns
2. **Text rendering**: SDF font for base letters at high zoom
3. **Picking**: Render feature IDs to a separate buffer for mouse interaction
4. **Integration**: Create a `WebGLBoxRendererType` that plugs into JBrowse's renderer system
5. **Spatial indexing**: Use a binned index to skip features outside viewport (GPU culling helps but CPU-side filtering is still useful)
6. **React integration**: OffscreenCanvas in a worker, or direct WebGL canvas component

## References

- [GenomeSpy](https://genomespy.app/) - Production WebGL genome browser
- [HiGlass](http://higlass.io/) - WebGL genomics visualization
- [regl](https://github.com/regl-project/regl) - Functional WebGL wrapper
- [TWGL](https://twgljs.org/) - Thin WebGL wrapper (used by GenomeSpy)
