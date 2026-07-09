import { buildMismatchArrays } from './buildArrays.ts'
import { packMismatches } from './packGpu.ts'
import * as mismatchShader from '../../LinearAlignmentsDisplay/shaders/slang/mismatch.generated.ts'

import type { MismatchUploadData } from './types.ts'
import type { MismatchData } from '../../shared/webglRpcTypes.ts'

function mm(position: number, qual: number): MismatchData {
  return { readIndex: 0, position, base: 65, strand: 1, qual }
}

describe('mismatch quality plumbing', () => {
  test('buildMismatchArrays carries per-base quality (already byte-valued)', () => {
    const { mismatchQuals } = buildMismatchArrays(
      [mm(10, 0), mm(11, 37), mm(12, 255)],
      0,
    )
    // qual comes straight from the BAM/CRAM QUAL byte array: 0 = no quality,
    // 37 = a real Phred value, 255 = the byte max (missing-QUAL sentinel).
    expect(Array.from(mismatchQuals)).toEqual([0, 37, 255])
  })

  test('quals stay aligned with positions after the regionStart filter', () => {
    const { mismatchPositions, mismatchQuals } = buildMismatchArrays(
      [mm(5, 40), mm(20, 12)],
      10,
    )
    expect(Array.from(mismatchPositions)).toEqual([20])
    expect(Array.from(mismatchQuals)).toEqual([12])
  })

  test('packMismatches writes the raw quality into the qual instance slot', () => {
    const data: MismatchUploadData = {
      mismatchPositions: new Uint32Array([100]),
      mismatchYs: new Uint16Array([0]),
      mismatchBases: new Uint8Array([65]),
      mismatchFrequencies: new Uint8Array([255]),
      mismatchQuals: new Uint8Array([37]),
    }
    const f32 = new Float32Array(packMismatches(data))
    expect(f32[mismatchShader.FIELD_OFFSET_F32.qual]).toBe(37)
  })
})
