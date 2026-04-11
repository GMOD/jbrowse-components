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

### WebGPU / WebGL premultiplied alpha — the rule is the same for both

**Do NOT premultiply RGB in fragment shaders.** Both backends use
`src-alpha / one-minus-src-alpha` blending against a `(0,0,0,0)` clear.
That blend equation naturally converts straight-alpha output into
premultiplied values in the framebuffer:
```
fb.rgb = src.rgb * src.a + 0 = src.rgb * alpha   ← premultiplied
fb.a   = src.a                                    = alpha
```
The WebGL canvas is created with `premultipliedAlpha: true` and the WebGPU
canvas uses `alphaMode: 'premultiplied'`, so in both cases the compositor
reads the framebuffer values directly:
```
output = fb.rgb + bg * (1 - fb.a)   ← correct
```
If you premultiply in the shader (`rgb * alpha`) AND the blend also multiplies
by `src-alpha`, you get `rgb * alpha²` in the framebuffer — AA edges appear
too dark and arcs look like they have a darker outline. This is a subtle bug
that has recurred across refactors; the fix is always to remove the
premultiplication from the shader.
