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

// -------------------------------------------------------------------------
// Two instancing patterns, two bind-group layouts.
//
// The HAL supports two ways to feed per-instance data to a shader:
//
//   1. Storage-buffer instancing (legacy, WGSL-native):
//        @group(0) @binding(0) var<storage, read> instances : array<T>;
//        @group(0) @binding(1) var<uniform> u : Uniforms;
//      Layout: createStandardBindGroupLayout
//      Data upload: createStorageBuffer
//      This is what the hand-written canvas/wiggle/variants shaders use.
//      Does not cross-compile to WebGL2 — WGSL storage buffers lower to SSBOs
//      which GLSL ES 3.00 doesn't support.
//
//   2. Vertex-buffer instancing (new, cross-compile-friendly):
//        @location(0) startEnd : vec2<u32>,  // etc., in the entry-point
//        @group(0) @binding(1) var<uniform> u : Uniforms;
//      Layout: createUniformOnlyBindGroupLayout
//      Data upload: createVertexBuffer
//      Pipeline: declares vertex.buffers with attribute layout
//      This matches the WebGL2 vertex-attribute pattern natively, which is
//      why shaders authored in Slang use this form — the same source emits
//      both targets without a UBO-fallback problem.
//
// Uniform binding index stays at 1 in both layouts so shaders share the
// same @binding(1) annotation regardless of which pattern they use.
// -------------------------------------------------------------------------

export function createUniformOnlyBindGroupLayout(device: GPUDevice) {
  return device.createBindGroupLayout({
    entries: [
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

// Bind group with only the uniform (for vertex-buffer passes).
export function createUniformOnlyBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniformBuffer: GPUBuffer,
  uniformVisibleSize: number,
) {
  return device.createBindGroup({
    layout,
    entries: [
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

// Create a GPU vertex buffer and upload data into it.
export function createVertexBuffer(
  device: GPUDevice,
  data: ArrayBuffer | ArrayBufferView,
) {
  const buf = device.createBuffer({
    size: Math.max(data.byteLength, 4),
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(buf, 0, data)
  return buf
}

// Convert a GL attribute descriptor (components + scalar type + integer flag)
// into the matching WebGPU vertex format string.
export function glToGpuVertexFormat(attr: {
  components: number
  type: 'float' | 'uint' | 'int'
  integer: boolean
}): GPUVertexFormat {
  const base = attr.type === 'uint' ? 'uint32' : attr.type === 'int' ? 'sint32' : 'float32'
  if (attr.components === 1) {
    return base as GPUVertexFormat
  }
  return `${base}x${attr.components}` as GPUVertexFormat
}

// Create a GPU storage buffer and upload data into it.
export function createStorageBuffer(
  device: GPUDevice,
  data: ArrayBuffer | ArrayBufferView,
) {
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
