/// <reference types="@webgpu/types" />

import { onDeviceLost } from './gpuDevice.ts'

import type { ShaderBinding, ShaderSource } from './hal/index.ts'

export interface ComputePipelineState {
  device: GPUDevice
  pipeline: GPUComputePipeline
  bindGroupLayout: GPUBindGroupLayout
  // Carried alongside the layout it was built from, so the bind group is
  // written against the same reflected indices.
  bindings: readonly ShaderBinding[]
}

// Built from the kernel's own reflected binding table rather than restated by
// the caller, so a mismatch shows up as a validation failure at pipeline
// creation rather than as a wrong buffer under a right-looking index.
function makeBindGroupLayout(
  device: GPUDevice,
  bindings: readonly ShaderBinding[],
) {
  return device.createBindGroupLayout({
    entries: bindings.map(b => {
      if (b.kind === 'texture' || b.kind === 'sampler') {
        throw new Error(
          `compute kernel: binding ${b.index} ('${b.name}') is a ${b.kind}, ` +
            `which a buffer-only dispatch does not bind`,
        )
      }
      return {
        binding: b.index,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: b.kind },
      }
    }),
  })
}

/**
 * One compute pipeline per kernel, built on first use against the current
 * device and rebuilt after a device loss. Concurrent first callers share the
 * one async build, which is also when the kernel's WGSL is loaded; a failed
 * one is retried by the next caller rather than kept.
 */
export function makeComputePipelineCache(
  source: Pick<ShaderSource, 'wgsl'>,
  entryPoint: string,
  bindings: readonly ShaderBinding[],
) {
  let state: ComputePipelineState | null = null
  let statePromise: Promise<ComputePipelineState> | null = null
  onDeviceLost(() => {
    state = null
    statePromise = null
  })
  return async function ensurePipeline(device: GPUDevice) {
    if (state?.device === device) {
      return state
    }
    if (statePromise) {
      return statePromise
    }
    statePromise = (async () => {
      try {
        const { WGSL_SOURCE } = await source.wgsl()
        const module = device.createShaderModule({ code: WGSL_SOURCE })
        const bindGroupLayout = makeBindGroupLayout(device, bindings)
        const pipeline = await device.createComputePipelineAsync({
          layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
          }),
          compute: { module, entryPoint },
        })
        state = { device, pipeline, bindGroupLayout, bindings }
        return state
      } finally {
        statePromise = null
      }
    })()
    return statePromise
  }
}
