/// <reference types="@webgpu/types" />

import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'
import { makeComputePipelineCache } from '@jbrowse/render-core/computePipeline'
import { getGpuDevice } from '@jbrowse/render-core/gpuDevice'

import { planDistanceDispatch } from './distanceDispatchPlan.ts'
import { findDistanceSpotCheckMismatch } from './distanceSpotCheck.ts'
import * as kernel from './shaders/sampleDistance.generated.ts'

import type { NumericRow } from './clusterMatrix.ts'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

// Pair-elements (n(n-1)/2 * v) below which the wasm wins. The dispatch has
// ~50 ms of fixed cost: at 464 rows x 512 columns (55M) the kernel loses
// outright, at 464 x 20,000 (2.2G) it is 2.2x, at 2504 x 3106 (9.7G) 6x.
const MIN_WORK = 1e9

const ensurePipeline = makeComputePipelineCache(
  kernel.WGSL_SOURCE,
  kernel.COMPUTE_ENTRY_POINT,
  kernel.BINDINGS,
)

function packSlab(
  rows: NumericRow[],
  v0: number,
  vc: number,
  slab: Float32Array,
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (ArrayBuffer.isView(row)) {
      slab.set((row as Float32Array).subarray(v0, v0 + vc), i * vc)
    } else {
      for (let k = 0; k < vc; k++) {
        slab[i * vc + k] = row[v0 + k]!
      }
    }
  }
}

/**
 * The upper triangle of the sample-by-sample Euclidean distance matrix on the
 * GPU, in the layout `clusterData({ distances })` reads, or null when the
 * work is too small, there is no WebGPU device, or the matrix does not fit
 * it. Throws on a dispatch that fails validation or reads back wrong, so the
 * caller's fallback reports why rather than clustering zeros.
 */
export async function gpuDistanceMatrix(
  rows: NumericRow[],
  stopTokenCheck?: StopTokenChecker,
): Promise<Float32Array | null> {
  const n = rows.length
  const v = rows[0]?.length ?? 0
  if (((n * (n - 1)) / 2) * v < MIN_WORK) {
    return null
  }
  const device = await getGpuDevice()
  if (!device) {
    return null
  }
  const plan = planDistanceDispatch(device.limits, n, v, {
    x: kernel.WORKGROUP_SIZE_X,
    y: kernel.WORKGROUP_SIZE_Y,
  })
  if (!plan) {
    return null
  }
  const { pipeline, bindGroupLayout, bindings } = await ensurePipeline(device)

  const cells = n * n
  const distBuffer = device.createBuffer({
    size: cells * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const readbackBuffer = device.createBuffer({
    size: cells * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })
  const uniformBuffer = device.createBuffer({
    size: kernel.UNIFORMS_SIZE_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const uniformData = new ArrayBuffer(kernel.UNIFORMS_SIZE_BYTES)
  const slab = new Float32Array(n * plan.slabColumns)
  let values: Float32Array
  try {
    for (let v0 = 0; v0 < v; v0 += plan.slabColumns) {
      checkStopTokenThrottled(stopTokenCheck)
      const vc = Math.min(plan.slabColumns, v - v0)
      const last = v0 + vc >= v
      packSlab(rows, v0, vc, slab)
      const dataBuffer = device.createBuffer({
        size: n * vc * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      })
      try {
        device.queue.writeBuffer(dataBuffer, 0, slab.buffer, 0, n * vc * 4)
        kernel.writeUniforms(uniformData, {
          n,
          v: vc,
          accumulate: v0 > 0 ? 1 : 0,
          finalize: last ? 1 : 0,
        })
        device.queue.writeBuffer(uniformBuffer, 0, uniformData)
        const bufferFor: Record<string, GPUBuffer> = {
          'read-only-storage': dataBuffer,
          storage: distBuffer,
          uniform: uniformBuffer,
        }
        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: bindings.map(b => ({
            binding: b.index,
            resource: { buffer: bufferFor[b.kind]! },
          })),
        })
        // Validation errors are asynchronous and leave the output unwritten
        // while mapAsync still resolves; the scope is what turns one into the
        // throw that routes this call to the wasm.
        device.pushErrorScope('validation')
        const encoder = device.createCommandEncoder()
        const pass = encoder.beginComputePass()
        pass.setPipeline(pipeline)
        pass.setBindGroup(0, bindGroup)
        pass.dispatchWorkgroups(plan.workgroupsX, plan.workgroupsY)
        pass.end()
        if (last) {
          encoder.copyBufferToBuffer(
            distBuffer,
            0,
            readbackBuffer,
            0,
            cells * 4,
          )
        }
        device.queue.submit([encoder.finish()])
        const validationError = await device.popErrorScope()
        if (validationError) {
          throw new Error(
            `distance matrix dispatch failed: ${validationError.message}`,
          )
        }
        await device.queue.onSubmittedWorkDone()
      } finally {
        dataBuffer.destroy()
      }
    }
    await readbackBuffer.mapAsync(GPUMapMode.READ)
    values = new Float32Array(readbackBuffer.getMappedRange()).slice()
  } finally {
    distBuffer.destroy()
    readbackBuffer.destroy()
    uniformBuffer.destroy()
  }
  const mismatch = findDistanceSpotCheckMismatch(values, rows)
  if (mismatch) {
    throw new Error(
      `distance matrix from the GPU disagrees with the CPU: ${mismatch}`,
    )
  }
  return values
}
