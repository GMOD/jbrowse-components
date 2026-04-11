/// <reference types="@webgpu/types" />

// Standard alpha blend state used by all WebGPU renderers.
// Fragment shaders must output STRAIGHT (non-premultiplied) alpha:
//   fragColor = vec4(rgb, alpha)   -- correct
//   fragColor = vec4(rgb*alpha, alpha) -- WRONG: double-applies alpha at edges
// The blend equation (src-alpha, one-minus-src-alpha) against the (0,0,0,0)
// clear converts the straight-alpha output into premultiplied values in the
// framebuffer (edge pixel: fb.rgb = color*alpha, fb.a = alpha).  The
// compositor then reads those correctly under alphaMode:'premultiplied':
//   output = fb.rgb + bg*(1-fb.a) = color*alpha + bg*(1-alpha)
// Premultiplying in the shader AND using src-alpha blend causes
// color*alpha^2 -- darker AA edges and overall dimming.
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
        resource: {
          buffer: uniformBuffer,
          offset: 0,
          size: uniformVisibleSize,
        },
      },
    ],
  })
}
