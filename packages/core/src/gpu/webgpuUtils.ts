/// <reference types="@webgpu/types" />

// Standard alpha blend state used by all WebGPU renderers.
export const STANDARD_BLEND_STATE: GPUBlendState = {
  color: {
    srcFactor: 'src-alpha',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
  alpha: {
    srcFactor: 'one',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
}

// Standard bind group layout: binding 0 = storage buffer, binding 1 = uniform buffer
// with dynamic offset for per-draw uniform batching.
export function createStandardBindGroupLayout(device: GPUDevice) {
  return device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' as GPUBufferBindingType },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {
          type: 'uniform' as GPUBufferBindingType,
          hasDynamicOffset: true,
        },
      },
    ],
  })
}

// Create a GPU storage buffer and upload data into it.
export function createStorageBuffer(device: GPUDevice, data: ArrayBuffer) {
  const buf = device.createBuffer({
    size: Math.max(data.byteLength, 4),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(buf, 0, data)
  return buf
}

// Create a standard bind group (storage at binding 0, uniform at binding 1).
// uniformVisibleSize is the byte range visible to the shader at each dynamic offset.
export function createStandardBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  storageBuffer: GPUBuffer,
  uniformBuffer: GPUBuffer,
  uniformVisibleSize: number,
) {
  return device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: storageBuffer } },
      {
        binding: 1,
        resource: { buffer: uniformBuffer, offset: 0, size: uniformVisibleSize },
      },
    ],
  })
}
