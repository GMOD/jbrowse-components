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
