import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { packSoftclipBases } from '../softclipBases/packGpu.ts'
import { buildMismatchArrays } from './buildArrays.ts'
import { emitMismatch } from './extract.ts'
import { packMismatches } from './packGpu.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'
import type { MismatchData } from '../../shared/webglRpcTypes.ts'
import type { MismatchUploadData } from './types.ts'

function mm(position: number, qual: number): MismatchData {
  return { readIndex: 0, position, base: 65, strand: 1, qual }
}

describe('mismatch quality plumbing', () => {
  test('buildMismatchArrays carries per-base quality (already byte-valued)', () => {
    const { mismatchQuals } = buildMismatchArrays(
      [mm(10, 0), mm(11, 37), mm(12, 255)],
      0,
    )
    // qual comes straight from the BAM/CRAM QUAL byte array: 0 and 37 are real
    // Phred values, 255 is QUAL_UNAVAILABLE. This builder passes all three
    // through — `emitMismatch` is where the sentinel is chosen.
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
    expect(f32[mismatchShader.INSTANCE_OFFSET_F32.qual]).toBe(37)
  })

  test('emitMismatch distinguishes Phred 0 from a read with no QUAL', () => {
    const out: MismatchData[] = []
    // The three shapes forEachMismatch reports: a score, the worst score, and
    // the two spellings of "this read has no QUAL".
    emitMismatch(0, 'A', 37, 0, 100, 1, out)
    emitMismatch(1, 'A', 0, 0, 100, 1, out)
    emitMismatch(2, 'A', -1, 0, 100, 1, out)
    emitMismatch(3, 'A', undefined, 0, 100, 1, out)
    expect(out.map(m => m.qual)).toEqual([
      37,
      0,
      QUAL_UNAVAILABLE,
      QUAL_UNAVAILABLE,
    ])
  })

  test('the softclip-bases pass packs the no-quality sentinel, not 0', () => {
    // It shares the mismatch shader, so leaving the slot at its zero default
    // would now read as Phred 0 and fade every clipped base away.
    const data = {
      softclipBasePositions: new Uint32Array([100]),
      softclipBaseYs: new Uint16Array([0]),
      softclipBaseBases: new Uint8Array([65]),
    } as CigarUploadData
    const f32 = new Float32Array(packSoftclipBases(data))
    expect(f32[mismatchShader.INSTANCE_OFFSET_F32.qual]).toBe(QUAL_UNAVAILABLE)
  })
})
