import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import * as gapShader from '../../shaders/slang/gap.generated.ts'
import { DELETION_MARK, SKIP_MARK } from './mark.ts'
import { packGaps } from './packGpu.ts'

import type { GapUploadData } from './types.ts'

const s32 = gapShader.INSTANCE_STRIDE_WORDS
const { startOff, endOff, y, gapType } = gapShader.INSTANCE_OFFSET_U32

// Interleaved on purpose: the two packers walk the same array and each has to
// skip the other's entries wherever they fall, so a run of one kind followed by
// a run of the other would pass on an implementation that only handled a
// prefix.
const GAPS: GapUploadData = {
  gapPositions: new Uint32Array([10, 20, 30, 40, 50, 60, 70, 80]),
  gapYs: new Uint16Array([0, 1, 2, 3]),
  gapTypes: new Uint8Array([GAP_SKIP, GAP_DELETION, GAP_SKIP, GAP_SKIP]),
  gapFrequencies: new Uint8Array([255, 128, 255, 255]),
}

function instances(buf: ArrayBuffer) {
  const u32 = new Uint32Array(buf)
  const out: { start: number; end: number; row: number; type: number }[] = []
  for (let o = 0; o < u32.length; o += s32) {
    out.push({
      start: u32[o + startOff]!,
      end: u32[o + endOff]!,
      row: u32[o + y]!,
      type: u32[o + gapType]!,
    })
  }
  return out
}

// `uploadPass` reads the instance count off the buffer's own byteLength, so an
// over-allocated buffer draws its trailing capacity as instances at position 0
// — a bar across the left edge of the block, with nothing to attribute it to.
test('each pass allocates exactly its own kind', () => {
  expect(instances(packGaps(GAPS, SKIP_MARK))).toEqual([
    { start: 10, end: 20, row: 0, type: GAP_SKIP },
    { start: 50, end: 60, row: 2, type: GAP_SKIP },
    { start: 70, end: 80, row: 3, type: GAP_SKIP },
  ])
  expect(instances(packGaps(GAPS, DELETION_MARK))).toEqual([
    { start: 30, end: 40, row: 1, type: GAP_DELETION },
  ])
})

// The two buffers replaced one, so between them they must still hold every gap
// exactly once. A kind packed by neither pass uploads nowhere and draws
// nothing, and nothing else in the wiring would say so — `GPU_PILEUP_PASS` is
// exhaustive over LAYERS, not over `gapTypes`.
test('the two passes partition the array', () => {
  const packed = [
    ...instances(packGaps(GAPS, SKIP_MARK)),
    ...instances(packGaps(GAPS, DELETION_MARK)),
  ]
  expect(packed).toHaveLength(GAPS.gapTypes.length)
  expect(packed.map(g => g.start).sort((a, b) => a - b)).toEqual([
    10, 30, 50, 70,
  ])
})

// The byte that selects nothing is no longer spellable: a consumer names one of
// the two marks, whose `selects` reads `gapTypes` rather than being handed a
// value to compare against it. The `@ts-expect-error` guard that used to stand
// here — `packGapsOfType(GAPS, 7)`, which compiled, allocated a zero-length
// buffer and drew nothing — is gone with the argument it guarded.
//
// What survives it is the other half: a byte that is neither kind is still
// packed by neither pass, which is what makes "a mark added to that array has to
// pick a pass" (plugins/alignments/src/CLAUDE.md) a property rather than a
// promise. Silent by construction on both backends, so it is pinned here.
test('a gap type belonging to neither mark is packed by neither pass', () => {
  const withUnknown: GapUploadData = {
    gapPositions: new Uint32Array([10, 20]),
    gapYs: new Uint16Array([0]),
    gapTypes: new Uint8Array([7]),
    gapFrequencies: new Uint8Array([255]),
  }
  expect(packGaps(withUnknown, SKIP_MARK).byteLength).toBe(0)
  expect(packGaps(withUnknown, DELETION_MARK).byteLength).toBe(0)
})

test('an empty payload packs an empty buffer', () => {
  const empty: GapUploadData = {
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapFrequencies: new Uint8Array(0),
  }
  expect(packGaps(empty, SKIP_MARK).byteLength).toBe(0)
})
