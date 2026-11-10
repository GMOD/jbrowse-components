import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { SOFTCLIP_BASES_MARK } from '../softclipBases/mark.ts'
import { buildMismatchArrays } from './buildArrays.ts'
import { emitMismatch } from './extract.ts'
import { MISMATCH_MARK } from './mark.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'
import type { MismatchData } from '../../shared/webglRpcTypes.ts'
import type { MismatchUploadData } from './types.ts'

function cell(buf: ArrayBuffer, i = 0) {
  const u32 = new Uint32Array(buf)
  const o = i * mismatchShader.INSTANCE_STRIDE_WORDS
  const word = u32[o + mismatchShader.INSTANCE_OFFSET_U32.rowFrequencyQual]!
  return {
    position: u32[o + mismatchShader.INSTANCE_OFFSET_U32.position],
    row: word & 0xffff,
    frequency: (word >>> mismatchShader.FREQUENCY_SHIFT) & 0xff,
    qual: word >>> mismatchShader.QUAL_SHIFT,
    base: u32[o + mismatchShader.INSTANCE_OFFSET_U32.base],
  }
}

function mm(position: number, qual: number): MismatchData {
  return { readIndex: 0, position, base: 65, strand: 1, qual }
}

describe('mismatch quality plumbing', () => {
  test('buildMismatchArrays carries per-base quality (already byte-valued)', () => {
    const { mismatchQuals } = buildMismatchArrays([
      mm(10, 0),
      mm(11, 37),
      mm(12, 255),
    ])
    // qual comes straight from the BAM/CRAM QUAL byte array: 0 and 37 are real
    // Phred values, 255 is QUAL_UNAVAILABLE. This builder passes all three
    // through — `emitMismatch` is where the sentinel is chosen.
    expect(Array.from(mismatchQuals)).toEqual([0, 37, 255])
  })

  test('the mismatch mark packs the raw quality into the qual instance slot', () => {
    const data: MismatchUploadData = {
      mismatchPositions: new Uint32Array([100]),
      mismatchYs: new Uint16Array([0]),
      mismatchBases: new Uint8Array([65]),
      mismatchFrequencies: new Uint8Array([255]),
      mismatchQuals: new Uint8Array([37]),
    }
    expect(cell(MISMATCH_MARK.pass.pack(data) as ArrayBuffer).qual).toBe(37)
  })

  test('the instance is 12 bytes: position, row|frequency|quality, base', () => {
    const data: MismatchUploadData = {
      mismatchPositions: new Uint32Array([100, 4_000_000_000]),
      mismatchYs: new Uint16Array([65535, 3]),
      mismatchBases: new Uint8Array([65, 116]),
      mismatchFrequencies: new Uint8Array([7, 255]),
      mismatchQuals: new Uint8Array([0, QUAL_UNAVAILABLE]),
    }
    const buf = MISMATCH_MARK.pass.pack(data) as ArrayBuffer
    expect(mismatchShader.INSTANCE_STRIDE_BYTES).toBe(12)
    expect(buf.byteLength).toBe(24)
    expect(cell(buf, 0)).toEqual({
      position: 100,
      row: 65535,
      frequency: 7,
      qual: 0,
      base: 65,
    })
    expect(cell(buf, 1)).toEqual({
      position: 4_000_000_000,
      row: 3,
      frequency: 255,
      qual: QUAL_UNAVAILABLE,
      base: 116,
    })
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
    // would read as Phred 0 and frequency 0 and fade every clipped base away.
    const data = {
      softclipBasePositions: new Uint32Array([100]),
      softclipBaseYs: new Uint16Array([0]),
      softclipBaseBases: new Uint8Array([65]),
    } as CigarUploadData
    expect(cell(SOFTCLIP_BASES_MARK.pass.pack(data) as ArrayBuffer)).toEqual({
      position: 100,
      row: 0,
      frequency: 255,
      qual: QUAL_UNAVAILABLE,
      base: 65,
    })
  })
})
