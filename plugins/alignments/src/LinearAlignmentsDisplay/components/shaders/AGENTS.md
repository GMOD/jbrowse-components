The GLSL shaders in this directory are hand-written, not auto-generated from the
WGSL sources in `../wgsl/`. The hand-written shaders use simple vertex
attributes (`in`) and individual `uniform` declarations, which is what the WebGL
renderer (`WebGLRenderer.ts`) expects.

## Keeping GLSL and WGSL in sync

Both shader codebases implement the same rendering logic. Look for `// SYNC(`
comments throughout both directories — these mark every shared value, formula,
and struct layout that must stay identical across the two implementations.

When editing a shader:

1. Search for `// SYNC(` in the file you're changing. Each marker names the
   counterpart file and describes what must match.
2. Apply the same change to the counterpart file listed in the marker.
3. If you add a new shared constant, formula, or struct field, add a
   `// SYNC(<counterpart>): <what must match>` comment in both files.

Mismatches between the GLSL and WGSL cause silent rendering bugs (wrong colors,
misaligned geometry, invisible features) that are difficult to diagnose because
the two backends may not be tested side-by-side.

## Three-way sync: Canvas 2D, WebGL, and WebGPU

The alignments display has three rendering backends that must stay synchronized:

1. **WebGL** (GLSL shaders in this directory + `WebGLRenderer.ts`)
2. **WebGPU** (WGSL shaders in `../wgsl/` + `AlignmentsRenderer.ts`)
3. **Canvas 2D** (`Canvas2DAlignmentsRenderer.ts`)

When changing rendering behavior (thresholds, colors, draw order, outline
logic), apply the same change to all three backends. The Canvas 2D renderer has
no shaders but implements the same logic in TypeScript.

### WebGPU premultiplied alpha

The WebGPU canvas uses `alphaMode: 'premultiplied'`. Any fragment shader that
outputs alpha < 1.0 must premultiply the RGB channels (i.e. `rgb * a`). Opaque
output (`a = 1.0`) does not need special handling. The WebGL backend also uses
`premultipliedAlpha: true` but handles blending before canvas compositing, so
the same straight-alpha fragment output works in both — except for arcs and
other anti-aliased geometry where the AA produces sub-pixel alpha. When in
doubt, premultiply in WGSL fragment shaders.
