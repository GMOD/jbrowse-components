import { COLOR_RAMP_LUT_ENTRIES, uploadColorRampLut } from './colorRampLut.ts'
import { MockHal } from './hal/index.ts'

import type { PipelineDescriptor } from './hal/index.ts'

const texturedPass = (id: string): PipelineDescriptor => ({
  id,
  wgslSource: '',
  glslVertex: '',
  glslFragment: '',
  instanceStride: 4,
  verticesPerInstance: 6,
  blend: true,
  vertexAttributes: [],
  textures: [
    {
      textureBinding: 2,
      samplerBinding: 3,
      glTextureUnit: 0,
      glUniformName: 'u_colorRamp',
      filter: 'linear',
    },
  ],
})

test('uploads the LUT as a 256×1 texture to every named pass', () => {
  const hal = new MockHal([texturedPass('a'), texturedPass('b')])
  const ramp = new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4)
  uploadColorRampLut(hal, ramp, ['a', 'b'])
  expect(hal.callsOf('uploadTexture').map(c => c.args)).toEqual([
    ['a', 1024, 256, 1],
    ['b', 1024, 256, 1],
  ])
})

test('refuses bytes that are not a 256-entry RGBA LUT', () => {
  const hal = new MockHal([texturedPass('a')])
  expect(() => {
    uploadColorRampLut(hal, new Uint8Array(3), ['a'])
  }).toThrow(/256-entry RGBA LUT/)
  expect(hal.callsOf('uploadTexture')).toHaveLength(0)
})
