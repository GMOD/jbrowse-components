import { packSoftclipBases } from './packBases.ts'
import * as mismatchShader from '../../LinearAlignmentsDisplay/shaders/slang/mismatch.generated.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'

// Softclip bases reuse the mismatch shader, whose sub-pixel fade lerps alpha
// from pxPerBp up to 1.0 by frequency. Leaving the slot at its 0 default made
// zoomed-out softclip bases fade to pxPerBp on the GPU while the Canvas2D path
// (drawSoftclipBases) drew them opaque. Full frequency is what pins alpha at 1.
test('packSoftclipBases writes full frequency so bases never fade', () => {
  const data = {
    softclipBasePositions: new Uint32Array([100, 101]),
    softclipBaseYs: new Uint16Array([0, 1]),
    softclipBaseBases: new Uint8Array([65, 67]),
  } as CigarUploadData

  const f32 = new Float32Array(packSoftclipBases(data))
  const s32 = mismatchShader.INSTANCE_STRIDE_F32
  const { frequency } = mismatchShader.FIELD_OFFSET_F32

  expect(f32[frequency]).toBe(1)
  expect(f32[s32 + frequency]).toBe(1)
})
