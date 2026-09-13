/// <reference types="@webgpu/types" />

import { STANDARD_BLEND_STATE, toGpuVertexFormat } from '../webgpuUtils.ts'

import type { BlendState, PipelineDescriptor, SampleCount } from './types.ts'

/**
 * The GPU objects that belong to the **device** rather than to one `WebGPUHal`,
 * memoized so the second display of a track type builds none of them.
 *
 * WebGL2 has no equivalent: a program belongs to the context that linked it,
 * so `WebGL2Hal` keeps the same content-keyed map per context instead. WebGPU
 * hands every display one device (`gpuDevice.ts`), and a `GPURenderPipeline` is
 * a device object. Ten alignments tracks once compiled 230 pipelines for 23
 * passes.
 *
 * Per copy of this module rather than on the `globalThis` cell, for the reason
 * `createHal.ts` gives for `warnedSoftwareRasterizer`: a second bundled copy
 * builds a second set, which costs a duplicate and never a wrong answer.
 * Layouts compare structurally in WebGPU, so a bind group from one copy is
 * valid against a pipeline from the other.
 */
const perDevice = new WeakMap<GPUDevice, DeviceGpuCache>()

/** The two pipeline layouts every pass is built against, built eagerly. */
export interface DeviceLayouts {
  uniformOnlyBindGroupLayout: GPUBindGroupLayout
  uniformOnlyPipelineLayout: GPUPipelineLayout
  texturedBindGroupLayout: GPUBindGroupLayout
  texturedPipelineLayout: GPUPipelineLayout
}

/**
 * What a pipeline is compiled from, and the cache's key: `WebGPUHal` builds
 * from this and nothing else, so a field the build reads cannot be missing from
 * the key. Two descriptors that differ only in `id` — one shader drawn as
 * several passes — share a pipeline.
 *
 * `uniformByteSize` is not in it: the layouts' uniform entry declares no
 * `minBindingSize`, so the size reaches the GPU only through each HAL's bind
 * group and dynamic offset. Nor is the canvas format, one value per page.
 */
export interface PipelineRecipe {
  wgslSource: string
  textured: boolean
  vertexBuffer: GPUVertexBufferLayout
  blend: GPUBlendState | undefined
  topology: GPUPrimitiveTopology
  /**
   * A property of the display, not the pass, and baked into the pipeline:
   * a pipeline built at 4 handed to a target at 1 has every draw rejected and
   * paints a blank canvas without an exception.
   */
  sampleCount: SampleCount
}

function gpuBlendState(bs: BlendState): GPUBlendState {
  // WebGPU rejects any factor but 'one' under max, though max ignores them —
  // the same blend as webgl2Hal's bare glBlendEquation(MAX). Otherwise RGB
  // takes the declared factors and alpha accumulates through ONE /
  // ONE_MINUS_SRC_ALPHA, as webgl2Hal's applyBlendState does.
  const max = { srcFactor: 'one', dstFactor: 'one', operation: 'max' } as const
  return bs.op === 'max'
    ? { color: max, alpha: max }
    : {
        color: { srcFactor: bs.srcFactor, dstFactor: bs.dstFactor },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      }
}

export function pipelineRecipe(
  desc: PipelineDescriptor,
  sampleCount: SampleCount,
): PipelineRecipe {
  return {
    wgslSource: desc.wgslSource,
    textured: !!desc.textures?.length,
    vertexBuffer: {
      arrayStride: desc.instanceStride,
      stepMode: 'instance',
      attributes: desc.vertexAttributes.map((attr, i) => ({
        shaderLocation: i,
        offset: attr.offsetBytes,
        format: toGpuVertexFormat(attr),
      })),
    },
    blend: desc.blend
      ? desc.blendState
        ? gpuBlendState(desc.blendState)
        : STANDARD_BLEND_STATE
      : undefined,
    topology: desc.topology ?? 'triangle-list',
    sampleCount,
  }
}

interface DeviceGpuCache {
  layouts: DeviceLayouts
  /**
   * WGSL source, then the rest of the recipe as JSON. The source is its own
   * level so the key holds the module const's string rather than a copy of it.
   *
   * Holds the in-flight **promise**: many tracks mount in one tick and every
   * `WebGPUHal.create` runs concurrently, so a memo of finished compiles would
   * miss on all of them. A rejection is cached too — a WGSL compile error is
   * deterministic, and whoever built it has already awaited it.
   */
  pipelines: Map<string, Map<string, Promise<GPURenderPipeline>>>
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
    entry = { layouts: createLayouts(device), pipelines: new Map() }
    perDevice.set(device, entry)
  }
  return entry
}

/**
 * The bind group and pipeline layouts for `device`, built once per device.
 *
 * A lost device drops out of the map with itself — `gpuDevice.ts` releases its
 * reference in the `.lost` handler and the next acquisition is a new object —
 * so there is no cache to invalidate by hand.
 */
export function getDeviceLayouts(device: GPUDevice) {
  return cacheFor(device).layouts
}

/**
 * The pipeline `recipe` compiles to on `device`, building it through `build`
 * on the first ask and handing every later one the same promise.
 */
export function getOrBuildPipeline(
  device: GPUDevice,
  recipe: PipelineRecipe,
  build: (
    layouts: DeviceLayouts,
    recipe: PipelineRecipe,
  ) => Promise<GPURenderPipeline>,
) {
  const { layouts, pipelines } = cacheFor(device)
  const { wgslSource, ...rest } = recipe
  let bySource = pipelines.get(wgslSource)
  if (!bySource) {
    bySource = new Map()
    pipelines.set(wgslSource, bySource)
  }
  const key = JSON.stringify(rest)
  let pipeline = bySource.get(key)
  if (!pipeline) {
    pipeline = build(layouts, recipe)
    bySource.set(key, pipeline)
  }
  return pipeline
}

/** Drop a device's entry. Tests only: losing the device is what invalidates it. */
export function resetDeviceGpuCacheForTests(device: GPUDevice) {
  perDevice.delete(device)
}
