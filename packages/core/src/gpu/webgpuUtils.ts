/// <reference types="@webgpu/types" />

// Standard alpha blend state (src-alpha, one-minus-src-alpha).
// Fragment shaders using this blend MUST output STRAIGHT (non-premultiplied) alpha:
//   fragColor = vec4(rgb, alpha)   -- correct
//   fragColor = vec4(rgb*alpha, alpha) -- WRONG: double-applies alpha at edges
// The blend multiplies src.rgb by src.a, which converts straight-alpha output
// into premultiplied values in the framebuffer.  The compositor reads those
// correctly under alphaMode:'premultiplied' / premultipliedAlpha:true.
// Premultiplying in the shader AND using src-alpha blend causes color*alpha^2.
//
// Some passes override this with { srcFactor:'one', dstFactor:'one-minus-src-alpha' }
// (premultiplied blend).  Those passes MUST output premultiplied alpha from the
// shader: vec4(rgb*alpha, alpha).  The two approaches are equivalent as long as
// the shader output and blend srcFactor agree (src-alpha↔straight, one↔premultiplied).
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
