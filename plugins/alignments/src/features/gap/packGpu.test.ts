import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import * as gapShader from '../../shaders/slang/gap.generated.ts'
import { packGapsOfType } from './packGpu.ts'

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
  expect(instances(packGapsOfType(GAPS, GAP_SKIP))).toEqual([
    { start: 10, end: 20, row: 0, type: GAP_SKIP },
    { start: 50, end: 60, row: 2, type: GAP_SKIP },
    { start: 70, end: 80, row: 3, type: GAP_SKIP },
  ])
  expect(instances(packGapsOfType(GAPS, GAP_DELETION))).toEqual([
    { start: 30, end: 40, row: 1, type: GAP_DELETION },
  ])
})

// The two buffers replaced one, so between them they must still hold every gap
// exactly once. A kind packed by neither pass uploads nowhere and draws
// nothing, and nothing else in the wiring would say so — `GPU_PILEUP_PASS` is
// exhaustive over LAYERS, not over `gapTypes`.
test('the two passes partition the array', () => {
  const packed = [
    ...instances(packGapsOfType(GAPS, GAP_SKIP)),
    ...instances(packGapsOfType(GAPS, GAP_DELETION)),
  ]
  expect(packed).toHaveLength(GAPS.gapTypes.length)
  expect(packed.map(g => g.start).sort((a, b) => a - b)).toEqual([
    10, 30, 50, 70,
  ])
})

// Compile-time only, and it guards itself: `GapTypeCode` is
// `typeof GAP_DELETION | typeof GAP_SKIP`, so if the generated constants ever
// gained a `: number` annotation the union would silently collapse to `number`
// — a type that documents the argument while checking nothing. Then this call
// would compile, the `@ts-expect-error` would go unused, and `pnpm typecheck`
// fails on the directive instead. Which is the point: the assertion breaks in
// both directions.
function typeGuard() {
  // @ts-expect-error a byte value that is neither gap kind selects nothing,
  // packs a zero-length buffer and draws nothing — silently, on both backends
  packGapsOfType(GAPS, 7)
}
void typeGuard

test('an empty payload packs an empty buffer', () => {
  const empty: GapUploadData = {
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapFrequencies: new Uint8Array(0),
  }
  expect(packGapsOfType(empty, GAP_SKIP).byteLength).toBe(0)
})
