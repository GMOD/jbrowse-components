import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { SOFTCLIP_BASES_MARK } from './mark.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'

// Softclip bases reuse the mismatch shader, whose sub-pixel fade lerps alpha
// from pxPerBp up to 1.0 by frequency. Leaving the byte at its 0 default made
// zoomed-out softclip bases fade to pxPerBp on the GPU while the Canvas2D path
// drew them opaque. Full frequency is what pins alpha at 1.
test('the softclip-bases mark packs full frequency so bases never fade', () => {
  const data = {
    softclipBasePositions: new Uint32Array([100, 101]),
    softclipBaseYs: new Uint16Array([0, 1]),
    softclipBaseBases: new Uint8Array([65, 67]),
  } as CigarUploadData

  const u32 = new Uint32Array(
    SOFTCLIP_BASES_MARK.pass.pack(data) as ArrayBuffer,
  )
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const { rowFrequencyQual } = mismatchShader.INSTANCE_OFFSET_U32
  const frequencyByte = (o: number) =>
    (u32[o + rowFrequencyQual]! >>> mismatchShader.FREQUENCY_SHIFT) & 0xff

  expect(frequencyByte(0)).toBe(255)
  expect(frequencyByte(s32)).toBe(255)
})
