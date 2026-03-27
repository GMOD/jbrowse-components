# Multi-Backend Renderer Unification Investigation

Date: 2026-03-26
Branch: webgl-poc

## Problem

The canvas rendering system has 3 backends (WebGPU, WebGL2, Canvas2D) with
drawing logic effectively implemented three times. Can we write rendering logic
once and have it target all three?

## Current Architecture

- `WebGPUFeatureRenderer.ts` (~595 lines) — WGSL shaders, storage buffers,
  interleaved instance data, command encoder + render pass
- `WebGLFeatureRenderer.ts` (~794 lines) — GLSL shaders, separate VBOs per
  attribute, instanced rendering via `drawArraysInstanced`
- `Canvas2DFeatureRenderer.ts` (~281 lines) — CPU-side JS drawing with
  `fillRect()`, `stroke()`, `beginPath()`, etc.
- `canvasShaders.ts` (~355 lines) — WGSL shader source for WebGPU
- `CanvasFeatureRenderer.ts` (~103 lines) — Orchestrator, tries WebGPU then
  WebGL2 then Canvas2D
- All backends implement the `CanvasFeatureBackend` interface
  (`uploadRegion`, `renderBlocks`, `pruneStaleRegions`, `dispose`)

All backends draw the same 4 primitives: rectangles, lines, chevrons, arrows.
All use the same high-precision (HP) coordinate splitting technique for
genome-scale positions.

## Libraries Investigated

### PixiJS (most relevant, code at ~/pixijs)

PixiJS does NOT transpile shaders. They write parallel WGSL + GLSL versions of
small "shader bits" (composable fragments), then assemble them into full shaders
via templates. Their architecture:

- Shared abstractions: Geometry, Buffer, Shader, State classes
- Backend Systems: GlBufferSystem vs GpuBufferSystem, etc.
- Adaptors: Convert generic "draw batch" instructions into backend-specific calls
- Auto-detection: dynamically imports only the needed renderer

This works for PixiJS because they have dozens of composable features (textures,
masks, filters, blend modes). Our codebase has 4 fixed shader programs that
never get remixed.

### Naga (WGSL-to-GLSL transpiler)

Rejected. Naga translates WGSL to GLSL but produces UBOs (Uniform Buffer
Objects) instead of vertex attribute buffers. Our WebGL2 backend uses separate
vertex attribute VBOs with `vertexAttribDivisor` for instancing, while our
WebGPU backend uses `var<storage, read>` storage buffers. This is a structural
mismatch, not just a syntax difference.

### Other options evaluated

- **wgpu compiled to WASM**: ~10MB bundle size, buggy WebGL fallback, no
  Canvas2D target. Not viable.
- **Three.js**: Too high-level for 2D instanced rectangles. Scene graph overhead,
  600KB+ bundle, custom HP math awkward in TSL.
- **Regl**: WebGL only, doesn't solve unification.
- **luma.gl v9**: Portable GPU API (WebGPU + WebGL2), but still requires dual
  shaders, no Canvas2D, adds dependency.
- **gpu.js**: Dead project, designed for GPGPU compute not drawing primitives.
- **OffscreenCanvas**: Orthogonal concern (where to render, not how).
- **Dawn/Tint**: C++ browser internals, not for web app consumption.

### WebGPU Compatibility Mode (Chrome 146+, Feb 2026)

WebGPU running on OpenGL ES 3.1 hardware. Could theoretically let us drop
WebGL2, but we need non-secure context support where WebGPU is unavailable.

## Full Abstraction Approach (PixiJS-style shader bits) — REJECTED

A plan was developed for a PixiJS-inspired shader bits system with unified
geometry definitions, shared interleave functions, and a common render loop
helper.

### Critical flaws identified

**The shader bits abstraction is shallow.** PixiJS needs composable shader bits
because they mix and match dozens of features. We have 4 fixed shader programs
that never get remixed. Splitting them into bits and reassembling adds
indirection without compositional benefit.

**Interleaved WebGL buffers serve the abstraction, not performance.** Switching
WebGL from separate VBOs to interleaved to match WebGPU's layout is non-trivial,
error-prone with mixed integer/float types, and the cache locality benefit is
negligible for instanced rendering where each instance is read once.

**`forEachBlock()` hides important backend differences.** WebGPU uses a single
command encoder with one render pass; WebGL uses immediate-mode state changes;
Canvas2D uses save/clip/restore. A unified callback would be leaky or bloated.

**The real maintenance cost is low.** Adding a new primitive type costs ~60 lines
across 3 backends. The proposed abstraction was ~300 lines of shared code. You'd
need 5+ new primitive types before it pays for itself.

**Bad abstractions lock you in.** If we later need backend-specific optimizations
(WebGPU compute shaders for culling, WebGL multi-draw, Canvas2D path batching),
a unified abstraction actively fights independent optimization.

## Recommended Approach — Extract shared constants and HP math

The only duplication worth eliminating is the HP (high-precision) math functions
(~50 lines duplicated in WGSL and GLSL) and shared constants (chevron
dimensions, min rect width, etc.). Extract these into a shared file. This:

- Eliminates the most error-prone duplication (precision math must stay in sync)
- Adds zero abstraction commitment
- Takes ~30 minutes, zero risk
- Keeps backends free to optimize independently

The current architecture (`CanvasFeatureBackend` interface with 3 independent
implementations) is already the right pattern — it's the strategy pattern that
PixiJS also uses at its highest level.

## Key Structural Differences Between Backends (why unification is hard)

| Aspect | WebGPU | WebGL2 | Canvas2D |
|--------|--------|--------|----------|
| Shader language | WGSL | GLSL ES 3.0 | N/A |
| Instance data | Storage buffers (interleaved) | Separate VBOs per attribute | Plain TypedArrays |
| Uniforms | Dynamic offset UBO | Individual `gl.uniform*` calls | N/A |
| Command model | Command buffer recording | Immediate-mode state machine | Immediate-mode drawing |
| Line draw | 6 verts (thin quad) | 2 verts (`gl.LINES`) | `ctx.stroke()` |
| Colors | f32 [0..1] in storage buffer | Normalized UNSIGNED_BYTE | `rgba()` strings |
| MSAA | 4x with resolve texture | None | N/A |
