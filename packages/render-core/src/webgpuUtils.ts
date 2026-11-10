/// <reference types="@webgpu/types" />

import type { ShaderStage } from './hal/types.ts'

const STAGE_FLAG = {
  vertex: 'VERTEX',
  fragment: 'FRAGMENT',
  compute: 'COMPUTE',
} as const

/** A layout entry's `visibility`: the stages its shader reads the binding in. */
export function stageVisibility(stages: readonly ShaderStage[]) {
  let mask = 0
  for (const stage of stages) {
    mask |= GPUShaderStage[STAGE_FLAG[stage]]
  }
  return mask
}

export function createVertexBuffer(
  device: GPUDevice,
  data: ArrayBuffer | ArrayBufferView,
) {
  const buf = device.createBuffer({
    // WebGPU buffers must be at least 4 bytes in size.
    size: Math.max(data.byteLength, 4),
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(buf, 0, data)
  return buf
}

/**
 * Converts one entry of a pass's vertex input layout to a WebGPU vertex format
 * string. Example: { components: 2, type: 'float' } -> 'float32x2'
 * @param attr - Vertex attribute descriptor.
 * @returns GPUVertexFormat string.
 */
export function toGpuVertexFormat(attr: {
  components: number
  type: 'float' | 'uint' | 'int'
}): GPUVertexFormat {
  const base =
    attr.type === 'uint' ? 'uint32' : attr.type === 'int' ? 'sint32' : 'float32'
  return attr.components === 1
    ? base
    : (`${base}x${attr.components}` as GPUVertexFormat)
}
