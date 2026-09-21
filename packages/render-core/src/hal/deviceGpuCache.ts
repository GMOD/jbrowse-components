/// <reference types="@webgpu/types" />

import {
  STANDARD_BLEND_STATE,
  stageVisibility,
  toGpuVertexFormat,
} from '../webgpuUtils.ts'

import type {
  BlendState,
  PipelineDescriptor,
  SampleCount,
  ShaderBinding,
} from './types.ts'

// A device's layouts and pipelines, shared by every WebGPUHal on it. Held per
// module copy rather than on the `globalThis` cell: a second bundled copy
// builds a duplicate set, never a wrong one, since WebGPU compares layouts
// structurally.
const perDevice = new WeakMap<GPUDevice, DeviceGpuCache>()

/** A pass's one bind-group layout, and the pipeline layout holding it as group 0. */
export interface PassLayout {
  bindGroupLayout: GPUBindGroupLayout
  pipelineLayout: GPUPipelineLayout
}

/**
 * A render pass's bind-group layout, read off its shader's reflected table:
 * each binding visible to exactly the stages that read it, so the layout
 * cannot disagree with the shader about which stage reads what. The uniform
 * block takes a dynamic offset into the HAL's ring.
 */
export function bindGroupLayoutEntries(
  bindings: readonly ShaderBinding[],
): GPUBindGroupLayoutEntry[] {
  return bindings.map((b): GPUBindGroupLayoutEntry => {
    const at = { binding: b.index, visibility: stageVisibility(b.stages) }
    switch (b.kind) {
      case 'uniform':
        return { ...at, buffer: { type: 'uniform', hasDynamicOffset: true } }
      case 'texture':
        return { ...at, texture: { sampleType: 'float' } }
      case 'sampler':
        return { ...at, sampler: { type: 'filtering' } }
      default:
        throw new Error(
          `a render pass binds no ${b.kind}, and '${b.name}' is one at ` +
            `binding ${b.index}`,
        )
    }
  })
}

/**
 * What a pipeline is compiled from and cached under: `WebGPUHal` builds from
 * nothing else. `uniformByteSize` stays out, since the layouts declare no
 * `minBindingSize`, and so does the page-wide canvas format.
 */
export interface PipelineRecipe {
  wgslSource: string
  bindGroupLayout: GPUBindGroupLayoutEntry[]
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
    bindGroupLayout: bindGroupLayoutEntries(desc.bindings),
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
  /** By the layout's entries as JSON: one per distinct binding table. */
  layouts: Map<string, PassLayout>
  /**
   * By WGSL source, then the rest of the recipe as JSON. The promise is held
   * in flight, since tracks mounting in one tick compile concurrently, and a
   * rejection stays, since a WGSL compile error is deterministic.
   */
  pipelines: Map<string, Map<string, Promise<GPURenderPipeline>>>
}

function cacheFor(device: GPUDevice): DeviceGpuCache {
  let entry = perDevice.get(device)
  if (!entry) {
    entry = { layouts: new Map(), pipelines: new Map() }
    perDevice.set(device, entry)
  }
  return entry
}

export function getPassLayout(
  device: GPUDevice,
  entries: GPUBindGroupLayoutEntry[],
): PassLayout {
  const { layouts } = cacheFor(device)
  const key = JSON.stringify(entries)
  let layout = layouts.get(key)
  if (!layout) {
    const bindGroupLayout = device.createBindGroupLayout({ entries })
    layout = {
      bindGroupLayout,
      pipelineLayout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
    }
    layouts.set(key, layout)
  }
  return layout
}

export function getOrBuildPipeline(
  device: GPUDevice,
  recipe: PipelineRecipe,
  build: (recipe: PipelineRecipe) => Promise<GPURenderPipeline>,
) {
  const { pipelines } = cacheFor(device)
  const { wgslSource, ...rest } = recipe
  let bySource = pipelines.get(wgslSource)
  if (!bySource) {
    bySource = new Map()
    pipelines.set(wgslSource, bySource)
  }
  const key = JSON.stringify(rest)
  let pipeline = bySource.get(key)
  if (!pipeline) {
    pipeline = build(recipe)
    bySource.set(key, pipeline)
  }
  return pipeline
}

export function resetDeviceGpuCacheForTests(device: GPUDevice) {
  perDevice.delete(device)
}
