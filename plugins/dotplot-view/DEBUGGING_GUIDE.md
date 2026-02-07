# Dotplot WebGL Debugging Guide

## Visual Indicators Added

To help diagnose rendering issues, visible colors have been added:
- **Light Gray Background** (#f5f5f5): Axes canvas background (should show in borders + plot area)
- **Light Blue Background** (#c0e0ff): WebGL canvas background when rendering (should show in plot area)
- **Features**: Rendered as black lines

If you see nothing, check the below diagnostics.

## Diagnostic Steps

### 1. Check Browser Console
Open DevTools (F12) and look for logs in this order:

#### Should See (When Page Loads):
```
DotplotAxesCanvas: initialized with dimensions { canvasWidth: X, canvasHeight: Y, ... }
DotplotWebGLCanvas: render called with dimensions { canvasWidth: X, canvasHeight: Y, ... }
DotplotWebGLCanvas: initializing renderer with canvas { ... }
DotplotWebGLRenderer.init: canvas.width = X, canvas.height = Y
```

#### Should See (When Track Enabled):
```
geometry reaction: executing
executeDotplotWebGLGeometry: called with N features
geometry reaction: calling RPC with N features
dotplotDrawAutorun: rendering with scroll offset { offsetX: X, offsetY: Y, ... }
buildGeometry: processing N features
render: SUCCESS - drew M vertices with offset { offsetX: X, offsetY: Y }
```

### 2. Visual Check

**Before Enabling Track:**
- You should see a light gray area (this is the axes canvas background)
- This confirms the layout is rendering

**After Enabling Track with Alignments:**
- The light gray area might still be visible
- The plot area (inside borders) might show:
  - Light blue background (if WebGL is rendering)
  - Black lines (if features are drawn)

### 3. If Light Gray is NOT Showing
- Layout issue: axes canvas not rendering
- Check console for errors from `DotplotAxesCanvas`
- Verify `borderX` and `borderY` are positive numbers

### 4. If Light Blue is NOT Showing
- WebGL canvas not rendering
- Check console for errors from `DotplotWebGLCanvas`
- Verify `canvasWidth` and `canvasHeight` are positive
- Check for WebGL context errors

### 5. If Colors Show but No Lines
- Rendering pipeline is working but features aren't being drawn
- Check for `render: SUCCESS` logs with vertex count > 0
- If no SUCCESS logs: buildGeometry isn't being called or failed
- Check for errors in geometry reaction

### 6. If Lines Are Out of Bounds
- Offset transformation issue
- Check logged offset values: `{ offsetX: X, offsetY: Y }`
- These should change as you pan/zoom
- Verify scroll offsets are non-negative

## Common Issues and Fixes

### Issue: Nothing Shows
**Possible Cause**: Dimensions are 0
**Fix**: Check that `view.viewWidth` and `view.viewHeight` are positive

### Issue: Only Gray, No Blue
**Possible Cause**: WebGL initialization failed
**Fix**: Check console for WebGL errors, verify canvas element is created

### Issue: No Features Drawn
**Possible Cause**: RPC called but returned 0 features
**Fix**: Verify alignment track has proper data and is enabled

### Issue: Lines Outside Bounds
**Possible Cause**: Offset not being applied
**Fix**: Check `render: SUCCESS` logs include offset values, verify shader is correct

## Enable More Detailed Logging

If needed, you can increase logging by checking for `console.log` calls in:
- `executeDotplotWebGLGeometry.ts` - logs first 3 features' coordinates
- `afterAttach.ts` - logs render parameters
- `drawDotplotWebGL.ts` - logs geometry creation
- `DotplotAxesCanvas.tsx` - logs dimensions
- `DotplotWebGLCanvas.tsx` - logs initialization

Search console for each log statement to trace execution flow.

## Expected Console Output Timeline

```
1. Page Load:
   DotplotAxesCanvas: initialized with dimensions...
   DotplotWebGLCanvas: render called with dimensions...
   DotplotWebGLCanvas: initializing renderer...
   DotplotWebGLRenderer.init: ...

2. Track Enabled:
   geometry reaction: executing
   executeDotplotWebGLGeometry: called with N features
   Feature 0: coords (x1, y1) -> (x2, y2)
   executeDotplotWebGLGeometry: returning N valid features
   geometry reaction: calling RPC with N features
   RPC result received

3. Rendering (Every Frame):
   dotplotDrawAutorun: rendering with scroll offset
   buildGeometry: processing N features
   buildGeometry: total vertices = M
   render: SUCCESS - drew M vertices
```

## Contact Points for Debugging

If something goes wrong, check these functions:
- `executeDotplotWebGLGeometry` - coordinate transformation
- `DotplotWebGLRenderer.buildGeometry` - vertex creation
- `DotplotWebGLRenderer.render` - WebGL state and draw call
- `DotplotAxesCanvas` - layout and positioning
- Shader code in `drawDotplotWebGL.ts` - coordinate transformations
