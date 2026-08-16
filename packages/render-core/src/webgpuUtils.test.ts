import { toGpuVertexFormat } from './webgpuUtils.ts'

// The WebGPU half of a pass's vertex input layout. The WebGL2 half reads the
// same `VertexAttributeLayout` through `vertexAttribPointer` /
// `vertexAttribIPointer`, and `assertVertexInputsMatch` checks each target
// against the shader at `pnpm gen:shaders` time — but nothing checks this
// mapping itself, and it is the one place the two targets could silently
// disagree about what a reflected attribute means. A wrong answer here is a
// pipeline built over a misread buffer: no validation error while the format is
// well-formed, just wrong numbers reaching the shader.
describe('toGpuVertexFormat', () => {
  it('drops the suffix for a scalar', () => {
    // 'float32x1' is not a GPUVertexFormat — a scalar is spelled bare.
    expect(toGpuVertexFormat({ components: 1, type: 'float' })).toBe('float32')
    expect(toGpuVertexFormat({ components: 1, type: 'uint' })).toBe('uint32')
    expect(toGpuVertexFormat({ components: 1, type: 'int' })).toBe('sint32')
  })

  it('maps int to sint32, which is the name WebGPU uses', () => {
    // The one spelling that is not a pass-through: our reflected type says
    // 'int', WebGPU says 'sint'.
    expect(toGpuVertexFormat({ components: 4, type: 'int' })).toBe('sint32x4')
  })

  it('suffixes the component count for vectors', () => {
    expect(toGpuVertexFormat({ components: 2, type: 'float' })).toBe(
      'float32x2',
    )
    expect(toGpuVertexFormat({ components: 3, type: 'float' })).toBe(
      'float32x3',
    )
    expect(toGpuVertexFormat({ components: 4, type: 'float' })).toBe(
      'float32x4',
    )
    expect(toGpuVertexFormat({ components: 2, type: 'uint' })).toBe('uint32x2')
  })
})
