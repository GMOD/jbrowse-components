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

// Per-instance data is always fed through a vertex buffer (matching Slang's
// vertex-attribute input semantics). The bind group carries only the uniform
// at binding 1 (and, optionally, a texture + sampler at 2/3). Binding index 1
// matches what the codegen emits so shaders share the same @binding(1)
// annotation regardless of whether they sample textures.

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
