/// <reference types="@webgpu/types" />

import { STANDARD_BLEND_STATE, toGpuVertexFormat } from '../webgpuUtils.ts'

import type { BlendState, PipelineDescriptor, SampleCount } from './types.ts'

// A device's layouts and pipelines, shared by every WebGPUHal on it. Held per
// module copy rather than on the `globalThis` cell: a second bundled copy
// builds a duplicate set, never a wrong one, since WebGPU compares layouts
// structurally.
const perDevice = new WeakMap<GPUDevice, DeviceGpuCache>()

export interface DeviceLayouts {
  uniformOnlyBindGroupLayout: GPUBindGroupLayout
  uniformOnlyPipelineLayout: GPUPipelineLayout
  texturedBindGroupLayout: GPUBindGroupLayout
  texturedPipelineLayout: GPUPipelineLayout
}

/**
 * What a pipeline is compiled from and cached under: `WebGPUHal` builds from
 * nothing else. `uniformByteSize` stays out, since the layouts declare no
 * `minBindingSize`, and so does the page-wide canvas format.
 */
export interface PipelineRecipe {
  wgslSource: string
  textured: boolean
  vertexBuffer: GPUVertexBufferLayout
  blend: GPUBlendState | undefined
  topology: GPUPrimitiveTopology
  /** Baked in: a pipeline built at 4 draws nothing into a target at 1. */
  sampleCount: SampleCount
}

function gpuBlendState(bs: BlendState): GPUBlendState {
  // WebGPU rejects any factor but 'one' under max, which ignores them. Alpha
  // accumulates as webgl2Hal's applyBlendState does.
  const max = { srcFactor: 'one', dstFactor: 'one', operation: 'max' } as const
  const behind = { srcFactor: 'one-minus-dst-alpha', dstFactor: 'one' } as const
  return bs.op === 'max'
    ? { color: max, alpha: max }
    : bs.op === 'behind'
      ? { color: behind, alpha: behind }
      : {
          color: { srcFactor: bs.srcFactor, dstFactor: bs.dstFactor },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
        }
}

export function pipelineRecipe(
  desc: PipelineDescriptor,
  wgslSource: string,
  sampleCount: SampleCount,
): PipelineRecipe {
  return {
    wgslSource,
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
   * By WGSL source, then the rest of the recipe as JSON. The promise is held
   * in flight, since tracks mounting in one tick compile concurrently, and a
   * rejection stays, since a WGSL compile error is deterministic.
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

export function getDeviceLayouts(device: GPUDevice) {
  return cacheFor(device).layouts
}

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

export function resetDeviceGpuCacheForTests(device: GPUDevice) {
  perDevice.delete(device)
}
