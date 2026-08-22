/// <reference types="@webgpu/types" />

import type { PipelineDescriptor, SampleCount } from './types.ts'

/**
 * The GPU objects that belong to the **device** rather than to one `WebGPUHal`,
 * memoized so the second display of a track type builds none of them.
 *
 * WebGL2 has no equivalent and wants none: a program is owned by the context
 * that linked it, and each display owns a context, so nothing there is
 * shareable. WebGPU inverts that — `gpuDevice.ts` hands every display one
 * device, and a `GPURenderPipeline` is a device object — and until this module
 * the HAL kept building per-display copies anyway. Ten alignments tracks
 * compiled 230 pipelines for 23 distinct programs.
 *
 * **The key is the descriptor object, and that is what makes it correct.** A
 * plugin's pass list is a module-level const (`ALIGNMENTS_PASSES`) and
 * `slangPass` reads `wgslSource` off a generated module const, so every display
 * of a type hands the HAL the *same* `PipelineDescriptor` objects by reference.
 * Identity therefore means "same shader, same layout, same blend, same
 * topology" without comparing any of them, and two passes that merely share a
 * `.slang` shape module (MAF and multi-row both draw `rowRect`) get separate
 * entries because `slangPass` built them separate objects. The **sample count**
 * is the one pipeline input the descriptor cannot express, so it is the inner
 * key; see the `pipelines` field.
 *
 * The one field of a pipeline that is not on the descriptor is the uniform
 * size, and it cannot make two HALs disagree here:
 * `createUniformOnlyBindGroupLayout` declares no `minBindingSize`, so the
 * layout — and thus the pipeline built against it — is the same whatever a
 * display's `uniformByteSize` is. The size reaches the GPU through the bind
 * group's `size` and the dynamic offset, both of which stay per-HAL.
 *
 * Per copy of this module rather than on the `globalThis` cell, for the reason
 * `createHal.ts` gives for `warnedSoftwareRasterizer`: a second bundled copy
 * builds a second set, which costs a duplicate and never a wrong answer.
 * Layouts compare structurally in WebGPU, so a bind group from one copy is
 * valid against a pipeline from the other.
 */
const perDevice = new WeakMap<GPUDevice, DeviceGpuCache>()

/**
 * The two pipeline layouts every pass is built against. Both are created
 * eagerly now — the textured pair used to be lazy so that a display drawing no
 * textured pass paid nothing, which was worth two objects per *display* and is
 * not worth the null-bundling for two objects per *device*.
 */
export interface DeviceLayouts {
  uniformOnlyBindGroupLayout: GPUBindGroupLayout
  uniformOnlyPipelineLayout: GPUPipelineLayout
  texturedBindGroupLayout: GPUBindGroupLayout
  texturedPipelineLayout: GPUPipelineLayout
}

interface DeviceGpuCache {
  layouts: DeviceLayouts
  /**
   * Holds the in-flight **promise**, not the resolved pipeline, so the common
   * case is deduplicated at all: many tracks mount in one tick and every
   * `WebGPUHal.create` runs concurrently, so a cache that only recorded
   * finished compiles would have every one of them miss.
   *
   * A rejection is cached too, and deliberately — a WGSL compile error is
   * deterministic, so the second display should fail with the first's message
   * rather than re-running a compile that cannot succeed. It has already been
   * awaited by whoever built it, so a stored rejection is not an unhandled one.
   *
   * **The inner key is the sample count**, which is the one thing a pipeline
   * bakes in that the descriptor does not carry: multisample state belongs to
   * the pipeline, and the count is a property of the *display* rather than of
   * the pass. Handing a display at 1x a pipeline built at 4x is not an error
   * the API reports at draw time — the render pass rejects every draw and the
   * canvas comes out blank — so the count has to be part of the key, not an
   * assumption about it.
   */
  pipelines: WeakMap<
    PipelineDescriptor,
    Map<SampleCount, Promise<GPURenderPipeline>>
  >
}

function createLayouts(device: GPUDevice): DeviceLayouts {
  const uniformEntry = {
    binding: 1,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: { type: 'uniform' as GPUBufferBindingType, hasDynamicOffset: true },
  }
  const uniformOnlyBindGroupLayout = device.createBindGroupLayout({
    entries: [uniformEntry],
  })
  const texturedBindGroupLayout = device.createBindGroupLayout({
    entries: [
      uniformEntry,
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' as GPUTextureSampleType },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' as GPUSamplerBindingType },
      },
    ],
  })
  return {
    uniformOnlyBindGroupLayout,
    uniformOnlyPipelineLayout: device.createPipelineLayout({
      bindGroupLayouts: [uniformOnlyBindGroupLayout],
    }),
    texturedBindGroupLayout,
    texturedPipelineLayout: device.createPipelineLayout({
      bindGroupLayouts: [texturedBindGroupLayout],
    }),
  }
}

function cacheFor(device: GPUDevice): DeviceGpuCache {
  let entry = perDevice.get(device)
  if (!entry) {
    entry = { layouts: createLayouts(device), pipelines: new WeakMap() }
    perDevice.set(device, entry)
  }
  return entry
}

/**
 * The bind group and pipeline layouts for `device`, built once per device.
 *
 * A device that is lost drops out of the map with itself — `gpuDevice.ts`
 * releases its reference in the `.lost` handler and the next acquisition is a
 * new object, so the layouts and pipelines built against the dead one are
 * unreachable and there is no cache to invalidate by hand.
 */
export function getDeviceLayouts(device: GPUDevice) {
  return cacheFor(device).layouts
}

/**
 * The pipeline for `desc` at `sampleCount` on `device`, building it through
 * `build` on the first ask and handing every later one the same promise.
 *
 * `build` receives the sample count rather than closing over one, so the key
 * and the pipeline stored under it cannot disagree.
 */
export function getOrBuildPipeline(
  device: GPUDevice,
  desc: PipelineDescriptor,
  sampleCount: SampleCount,
  build: (
    layouts: DeviceLayouts,
    sampleCount: SampleCount,
  ) => Promise<GPURenderPipeline>,
) {
  const { layouts, pipelines } = cacheFor(device)
  let bySampleCount = pipelines.get(desc)
  if (!bySampleCount) {
    bySampleCount = new Map()
    pipelines.set(desc, bySampleCount)
  }
  let pipeline = bySampleCount.get(sampleCount)
  if (!pipeline) {
    pipeline = build(layouts, sampleCount)
    bySampleCount.set(sampleCount, pipeline)
  }
  return pipeline
}

/**
 * Drop every device's entry. Tests only — nothing in the app invalidates this
 * cache, because losing the device is what invalidates it (see
 * {@link getDeviceLayouts}).
 */
export function resetDeviceGpuCacheForTests(device: GPUDevice) {
  perDevice.delete(device)
}
