# MultiLGVSyntenyDisplay Rendering Investigation Plan

## Context

The MultiLGVSyntenyDisplay is not rendering properly. This plan guides the
next agent through a systematic browser-based investigation.

## Pre-requisites

- Run `yarn start` in `products/jbrowse-web` (or confirm dev server is running)
- Load a config with MultiLGVSyntenyDisplay (e.g. volvox pangenome or HPRC chrM)
- Open Chrome DevTools console

## Step 1: Verify Data Arrives from RPC

Look for console logs in the browser:

```
[MultiSyntenyFetch] Starting RPC, bpPerPx: ... regions: ...
[MultiSyntenyFetch] RPC complete, genomeRows keys: [...] total features: N
```

**If total features = 0**: The problem is in the adapter/data layer, not rendering.
Check BINARY_ALN_DEBUG.md for the ref-assembly mismatch issue.

**If total features > 0**: Data is arriving. Proceed to Step 2.

## Step 2: Check Model State

In browser console, access the model via the session:

```js
// Find the display model
const session = document.querySelector('[data-testid="multi_synteny_canvas"]')
  ?.__jb_model // or use React DevTools to find the model

// Or from the session object if accessible:
// session.views[0].tracks[0].displays[0]
```

Check:
- `model.genomeRows.size` > 0?
- `model.allGenomeNames.length` > 0?
- `model.displayedGenomes.length` > 0?
- `model.height` > 0?
- `model.rowHeight` > 0?
- `model.dataVersion` incrementing on scroll?

**If displayedGenomes is empty**: Check if `allGenomeNames` has the reference
genome name filtered out incorrectly. The `displayedGenomes` view filters out
`referenceGenomeName` (from `view.displayedRegions[0].assemblyName`).

**If rowHeight = height** (only 1 row): Only 1 genome is displayed. The ref
genome may not be in `allGenomeNames`, or all genomes are filtered.

## Step 3: Check Renderer Initialization

The renderer is initialized in a `useEffect` and sets `ready=true` on success.

Add a temporary log or check console for:
```
Failed to initialize multi-synteny renderer: ...
```

If no error, check what backend was selected:
- Look for `[MultiSyntenyRenderer]` logs or add them
- The `MultiSyntenyRenderer.getOrCreate(canvas).init()` tries:
  1. WebGPU (if `getGpuOverride() !== 'canvas2d'`)
  2. WebGL2
  3. Canvas2D fallback

**Test with Canvas2D forced**: Set `localStorage.setItem('jbrowse-gpu-override', 'canvas2d')`
and reload. If Canvas2D renders but GPU doesn't, the issue is GPU-specific.

## Step 4: Check Canvas Dimensions

The canvas element must have proper `width`/`height` attributes (not just CSS):

```js
const canvas = document.querySelector('[data-testid="multi_synteny_canvas"]')
console.log('CSS:', canvas.style.width, canvas.style.height)
console.log('Attr:', canvas.width, canvas.height)
```

The renderer's `renderCanvas()` and GPU backends set canvas.width/height
internally. If they're 0 or very small, rendering will be invisible.

For GPU: check that `canvas.width = width * devicePixelRatio` and
`canvas.height = height * devicePixelRatio`.

## Step 5: Check Autorun Execution

The three autoruns in `MultiSyntenyRendering.tsx` are key:

1. **Upload autorun** (GPU only): uploads geometry when genomeRows changes
2. **Draw autorun** (GPU only): renders when view changes
3. **Canvas2D autorun**: full render on any change

**Critical condition**: All autoruns gate on `ready === true`. If the renderer
init promise never resolves (or resolves after component unmounts), no rendering
happens.

Add temporary `console.log` inside each autorun to verify they fire:
- Before the `if (renderer?.isGpu)` check
- Inside the GPU upload path
- Inside the GPU draw path
- Inside the Canvas2D path

## Step 6: GPU-Specific Checks

### WebGL2
- Check `gl.getError()` after draw calls
- Verify instance buffer has data: `renderer.instanceCount > 0`
- Check `computeRegionRenderParams()` returns valid params for content blocks
- Verify `refNameIndex` maps content block refNames correctly

### WebGPU
- Check `device.lost` promise
- Verify bind group creation succeeds
- Check command encoder submission

### Common GPU Issues
- `contentBlocks` may be empty if the view hasn't finished initializing
- `refNameIndex` may not contain the refName used by static blocks
- Instance offset calculation could exceed buffer bounds

## Step 7: Canvas2D-Specific Checks

If using Canvas2D backend:
- `bpToPx(refName, coord)` may return `undefined` for features outside the view
- All features might be off-screen (clipped by `if off-screen: skip` check)
- Feature colors might match background (check `colorBy` mode)

## Step 8: Check Feature Coordinate Alignment

Features have `origRefName` which must match the view's `refName` for
`bpToPx()` to work. If the adapter returns features with qualified names like
`GRCh38#0#chr20` but the view uses `chr20`, coordinate mapping will fail.

```js
// Check what refNames the view uses
view.staticBlocks.contentBlocks.map(b => b.refName)

// Check what refNames features have
[...model.genomeRows.values()].flat().slice(0, 5).map(f => f.origRefName)
```

These must match for rendering to work.

## Step 9: Check Content Blocks for GPU Path

The GPU draw autorun uses `view.staticBlocks.contentBlocks`. If these are
empty or have refNames not matching the GPU's `refNameIndex`, no instances
will be drawn.

`computeRegionRenderParams()` looks up the refName in the sorted instance
buffer. If it doesn't find a match, it logs a warning and skips the block.

## Likely Root Causes (Ranked)

1. **Data layer returns 0 features** - ref-assembly mismatch in binary aln
   (see BINARY_ALN_DEBUG.md)
2. **refName mismatch** - features have qualified refNames but view uses bare
   names (or vice versa)
3. **Renderer init fails silently** - GPU context creation fails, ready never
   set to true
4. **Canvas dimensions = 0** - display height not computed yet
5. **displayedGenomes empty** - all genomes filtered (reference name matching)
6. **Autorun not firing** - race condition between ready state and data arrival

## Quick Diagnostic Script

Paste in browser console after the display loads:

```js
(() => {
  const canvas = document.querySelector('[data-testid="multi_synteny_canvas"]')
  if (!canvas) return console.log('No canvas found')
  console.log('Canvas size:', canvas.width, 'x', canvas.height)
  console.log('CSS size:', canvas.style.width, canvas.style.height)

  // Check if anything was drawn (non-transparent pixels)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let nonEmpty = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) nonEmpty++
    }
    console.log('Non-empty pixels:', nonEmpty, '/', canvas.width * canvas.height)
  } else {
    console.log('Canvas has WebGL/WebGPU context (not 2D)')
  }
})()
```

Note: if the canvas is GPU-rendered, you can't read pixels via 2D context.
Instead check the GPU buffer state directly through the renderer reference.

## Files to Examine

| File | What to check |
|------|---------------|
| `model.ts:180-298` | onFetchNeeded, data flow, console logs |
| `MultiSyntenyRendering.tsx:164-427` | Autoruns, ready state, canvas setup |
| `MultiSyntenyRenderer.ts` | Backend selection, init, getOrCreate cache |
| `Canvas2DMultiSyntenyRenderer.ts` | renderCanvas method, bpToPx usage |
| `WebGLMultiSyntenyRenderer.ts` | uploadGeometry, renderGpu, computeRegionRenderParams |
| `gfaTabixUtils.ts:445-461` | getMultiPairFeatures dispatch |
| `gfaTabixUtils.ts:641-722` | getMultiPairFeaturesFromAlnBin, chrom name resolution |
