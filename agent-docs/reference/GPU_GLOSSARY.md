---
name: gpu-glossary
description: A plain-language GPU rendering glossary and Canvas2D to GPU primer, plus a table mapping standard real-time-graphics terms onto our spellings. Read when writing about GPU internals for a non-specialist audience, or when you need the standard name for something in the render path.
audience: internal
kind: spec
---

# GPU Rendering Glossary & Primer

A plain-language guide to how JBrowse draws tracks on the GPU, plus the precise
vocabulary for writing about it — for anyone from leadership to a plugin author
to whoever's drafting the paper.

How to read it, by audience:
- **New to GPU graphics:** §1 gives the mental model.
- **Writing the paper / talk:** §1 and §2 are the techniques.
- **Already know real-time graphics, or prompting an agent that does:** §3 maps
  the standard terms onto our spellings and names the file that owns each.

---

## 1. Primer: from Canvas2D to the GPU

**Canvas2D is a pen; the GPU is a printing press.** Drawing 50,000 genes in
Canvas2D is a JavaScript loop calling `ctx.fillRect` 50,000 times on the CPU. On the
GPU you write all 50,000 positions and colors into one list of numbers, hand the
list over once, and say "draw all of these"; hundreds of cores color the pixels in
parallel. The cost is setup: the GPU has its own memory and rules, so you must
package the data the way the hardware wants it, copy it across, and give the GPU a
tiny program that turns one list entry into pixels.

| Canvas2D | GPU equivalent | Plain meaning |
|---|---|---|
| `fillRect` in a loop | one instanced **draw call** | draw many copies of a shape at once |
| `fillStyle = color` | the **fragment shader** | the code that picks each pixel's color |
| computing `x` from a coordinate | the **vertex shader** | the code that places each corner on screen |
| `ctx.clip()` | the **scissor** rectangle | "only paint inside this box" |
| `globalAlpha` / compositing | **blending** | how a new color mixes with what's there |
| the canvas itself | the **framebuffer** | the image being drawn into |

**The pipeline** is the fixed sequence every draw call passes through: buffer →
**vertex shader** (once per corner: where on screen?) → **rasterizer** (fixed:
which pixels a triangle covers, and interpolation of vertex outputs across them) →
**fragment shader** (once per pixel: what color?) → **blending** (fixed) →
**framebuffer**. The two shaders are the stages you write. A shader is the inside of
your draw loop shipped to the GPU: the `x = (f.start - viewStart) * pxPerBp` line is
the vertex shader, the `fillStyle` line the fragment shader.

Ideas Canvas2D never exposed:

- **Clip space** is the GPU's −1…+1 coordinate system, regardless of resolution; the
  vertex shader converts into it. Unrelated to Canvas2D's `clip()`, which is the
  **scissor**.
- **Interpolation (varyings)**: a value set at the corners blends across the shape
  before the fragment shader sees it.
- **Shader invocations run the same code on their own data and cannot see
  neighbors.** Divergent `if` branches between neighboring pixels are slow.
- **No objects or allocation**: shaders work in small fixed vectors (`float2`,
  `float4`).
- **Uniforms vs attributes**: an *attribute* differs per gene and lives in the
  packed buffer; a *uniform* is one value for the whole draw call (zoom, canvas
  size).
- **Textures and samplers**: a texture is an image or color strip in GPU memory
  (our palettes); a sampler is the rule for reading it (nearest or blended).

**Data path: compute → pack → transfer → upload → draw.** A worker computes
geometry off the UI thread; the values are *packed* into one flat typed array with a
fixed byte count per gene (the **instance stride**); the block is *transferred*
zero-copy (the worker gives up ownership); it is *uploaded* to GPU memory
(`hal.uploadBuffer`), the one cost Canvas2D never pays; and `hal.drawPass` draws it.
Pan and zoom re-run the shaders over resident data, and only a newly visible region
triggers an upload.

**Instancing** is why the GPU path beats the loop. Every gene is the same shape, a
**quad** (two triangles), differing in place, size and color. Describe the rectangle
once, put the per-gene differences in the packed buffer, and fire one draw call that
says "draw this rectangle N times; copy *i* reads row *i*". The shader is told which
corner and which instance it is.

---

## 2. What's special about our GPU work

### 2a. One shader source, two GPU APIs
WebGPU speaks WGSL and WebGL2 speaks GLSL. We write each shader once in **Slang**; a
build step compiles it ahead of time to both, plus a TypeScript file describing the
packed buffer's byte layout, so CPU-side packing cannot drift from what the shader
expects. The generated files are checked in and `pnpm gen:shaders` regenerates them.

### 2b. Sub-pixel accuracy across a 3-billion-base genome (hp-math)
32-bit floats lose ~256 bases of precision near the end of a human genome. Each
coordinate is split into a high and a low part, with the position math done on the
parts separately (technique adapted from genome-spy, MIT). The shader compiler would
"optimize" the parts back into one number, so the math is written to stop it. Detail
in [BP_PRECISION.md](BP_PRECISION.md).

### 2c. One interface over three backends (the HAL)
Track code never calls WebGPU or WebGL2 directly. Both sit behind the **HAL**, which
exposes verbs like upload, draw pass and scissor, and the same code can run on a pure
CPU **Canvas2D** backend. A change to one GPU backend must be mirrored in the other
and in the test mock ("HAL parity").

**The GPU path is opt-in; Canvas2D is the baseline.** Every display ships a Canvas2D
draw function (image/SVG export requires one), so a display can be Canvas2D-only
(`createCanvas2DBackend`) and gets the shader path only through the dual-path
`createRenderingBackend`. The lifecycle machinery (`RenderLifecycleMixin` /
`DisplayChrome`) is backend-agnostic. Start a new display on Canvas2D and promote it
only once profiling shows it cannot hold 60fps at real feature counts (≳100K
features per frame).

### 2d. Scissor, not clip paths
Each genomic block is clipped with the GPU **scissor**. The Canvas2D fallback clamps
to the same rectangle, so all three backends clip identical pixels.

### 2e. Per-region and global backends
Most tracks are **per-region**: each block is uploaded and drawn separately and
discarded on scroll. Dense displays (Hi-C, LD, the variant matrix) are **global**: one
upload and one draw.

### 2f. Packed colors
Each color is packed into one integer in the gene's record, so uploads are smaller
([COLOR_REPRESENTATIONS.md](COLOR_REPRESENTATIONS.md) holds the byte-order trap).

### 2g. Zero-copy: parse output is the upload payload
The worker decodes straight into the GPU's binary layout and transfers the buffer
(ownership moves, the sender's buffer is detached); the main thread passes the same
bytes to `hal.uploadBuffer`. Where encoding depends on theme or settings rather than
raw data (MAF), the main thread packs, so a recolor re-runs only the cheap pack step,
and packing run-length-merges so the instance count tracks color transitions rather
than base count.

---

## 3. Standard graphics terms → our spelling

For someone who knows real-time graphics, or an agent prompted in its vocabulary:
which of our identifiers is the thing they already have a word for. Two entries are
collisions rather than translations: **a "pass" identifier means a PSO**, and **our
uniform "ring buffer" does not wrap**.

| Standard term | Our spelling | Owned by |
|---|---|---|
| **Pipeline state object (PSO)** | `PipelineDescriptor` — but every identifier around it still says *pass* (`passId`, `drawPass`, `slangPass`, `InstancePass`, `*_PASSES`) | `hal/types.ts`, built by `slangPass()` |
| **Render pass** (`beginRenderPass`) | the `beginFrame` / `endFrame` bracket — one per frame, not per `drawPass` | `webgpuHal.ts`, `webgl2Hal.ts` |
| **Draw call** | `hal.drawPass(passId, regionKey)` | `hal/types.ts` |
| **Instanced rendering** | the whole architecture — `stepMode: 'instance'`, `draw(verticesPerInstance, count)` | `InstancePass`, `uploadPass`, `instanceCache.ts` |
| **Instance buffer / per-instance data** | the packed buffer a pass's `pack()` returns; `instanceStride` is its bytes-per-item | `instancePass.ts` |
| **Vertex input layout** | `vertexAttributes` (`VertexAttributeLayout`, generated as `VERTEX_ATTRIBUTES`), derived from the shader by codegen, never hand-written | `hal/types.ts`, emitted by the Slang codegen |
| **Bind group / layout** | same words; the layout is built from the shader's `BINDINGS`; `passBindGroups` shares one group across passes over one untextured layout | `bindGroupLayoutEntries` in `deviceGpuCache.ts`, `webgpuHal.getBindGroup` |
| **Pipeline layout** | same word | `PassLayout` in `deviceGpuCache.ts` |
| **Shader reflection** | `ShaderBinding` / a shader module's `BINDINGS` export | `packages/shader-tools/src/shader-codegen/reflection.ts` |
| **UBO / uniform buffer** | `writeUniforms`, bound at `@binding(1)` with `hasDynamicOffset` | `webgpuUtils.ts` |
| **Dynamic uniform offset** | the per-draw `dynamicOffset` in `drawPass` | `webgpuHal.ts` |
| **Ring buffer** | `uniformRingBuffer` — **collision**: reset to slot 0 every `beginFrame`, so it is a per-frame linear arena, and ordering against the previous submit is what makes that safe | `webgpuHal.ts` |
| **Staging buffer** | `uniformStaging` — coalesces a frame's uniform writes into one `queue.writeBuffer` at submit | `webgpuHal.ts` |
| **SSBO / storage buffer** | `storage` / `read-only-storage` bindings — **compute only**, never the render path (GLSL ES has no SSBOs) | `packages/render-core/src/computePipeline.ts` |
| **Compute pipeline / workgroup dispatch** | same words; a 2D workgroup grid clears `maxComputeWorkgroupsPerDimension`. Through `makeComputePipelineCache`; the in-tree user is `tree-sidebar`'s `gpuDistanceMatrix.ts` | `packages/render-core/src/computePipeline.ts` |
| **Blend state** | `BlendState`, `STANDARD_BLEND_STATE` | `hal/types.ts`, `webgpuUtils.ts` |
| **Primitive topology** | `PipelineDescriptor.topology` | `hal/types.ts` |
| **MSAA / resolve target** | `SampleCount` — per display via `RenderingBackendOptions.sampleCount`, defaulting to `deriveSampleCount(passes)` (1 when every pass is `coverage: 'analytic'`, else 4); `msaaView` + `resolveTarget` | `hal/types.ts`, `webgpuHal.ts` |
| **Scissor / viewport** | same words | `hal/types.ts` |
| **Frustum culling** | "cull" — CPU-side over a 1D bp interval; there is no frustum and no camera | `syntenyTypes.slang`, `syntenyFetchWindow.ts` |
| **Spatial index / BVH** | Flatbush (packed Hilbert R-tree) — **picking and hit-testing only**, never draw culling | `packages/core/src/util/flatbush/` |
| **Scene graph** | the MST view → track → display tree; we never call it that | `ARCHITECTURE.md` §"Display stacks" |
| **Render graph / frame graph** | none, deliberately | GPU_HAL.md §"What this architecture deliberately does not have" |
| **Indirect drawing** | none, deliberately | same |
| **Buffer pooling / sub-allocation** | none — one `GPUBuffer` per `(regionKey, passId)` | same |

A *worker* (background thread) is unrelated to a GPU *workgroup*.
