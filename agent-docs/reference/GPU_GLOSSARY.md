---
name: gpu-glossary
description: Which of our identifiers is the standard real-time-graphics term (PSO, render pass, UBO, ring buffer, SSBO, MSAA), and which file owns it? Read when you need the standard name for something in the render path.
audience: internal
kind: spec
---

# GPU glossary: standard terms to our spelling

Which of our identifiers is the thing a graphics programmer already has a word
for. Two entries are collisions rather than translations: **a "pass" identifier
means a PSO**, and **our uniform "ring buffer" does not wrap**.

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
| **Render graph / frame graph** | none: one render pass, one colour attachment, no offscreen target, and ordering is a static z-ordered mark list | `PILEUP_MARKS`, `RegionRegistry` |
| **Indirect drawing** | none: the instance count is `byteLength / instanceStride` of a CPU-packed buffer, so no GPU readback exists to remove. A pass whose instances a compute kernel produces would reopen it | `InstancePass` |
| **Buffer pooling / sub-allocation** | none — one `GPUBuffer` per `(regionKey, passId)` | [GPU_HAL.md](GPU_HAL.md) §"What this architecture deliberately does not have" |
