import { buildMultiRowInstanceBuffer } from './multiRowInstanceBuffer.ts'
import {
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from './shaders/multiRow.generated.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

interface DecodedInstance {
  startBp: number
  endBp: number
  rowIndex: number
  color: number
}

// The encoder returns the bytes alone, so the count is read off them the way
// the upload reads it — which is also the invariant worth asserting: a buffer
// right-sized to what was written, never the one-per-feature seed.
function decode(buffer: ArrayBuffer): DecodedInstance[] {
  expect(buffer.byteLength % INSTANCE_STRIDE_BYTES).toBe(0)
  const u32 = new Uint32Array(buffer)
  const out: DecodedInstance[] = []
  for (let i = 0; i < buffer.byteLength / INSTANCE_STRIDE_BYTES; i++) {
    const base = i * INSTANCE_STRIDE_WORDS
    out.push({
      startBp: u32[base + INSTANCE_OFFSET_U32.startBp]!,
      endBp: u32[base + INSTANCE_OFFSET_U32.endBp]!,
      rowIndex: u32[base + INSTANCE_OFFSET_U32.rowIndex]!,
      color: u32[base + INSTANCE_OFFSET_U32.color]!,
    })
  }
  return out
}

const region: MultiRowRegionData = {
  featureStarts: Uint32Array.from([10, 20, 30]),
  featureEnds: Uint32Array.from([15, 25, 35]),
  featureColors: Uint32Array.from([0xff0000ff, 0xff00ff00, 0xffff0000]),
  partitionValues: ['momHP0', 'dadHP1'],
  featurePartitionIndex: Uint32Array.from([0, 1, 0]),
  featureNames: ['a', 'b', 'c'],
  featureIds: ['f1', 'f2', 'f3'],
  featureDeltas: new Int32Array(0),
  usedItemRgb: false,
  partitionCandidates: [],
  legendCandidates: [],
  resolvedPartitionField: 'name',
}

// The three inputs to "does this feature paint, and in what color". Always
// supplied together (see MultiRowRenderState), so the tests build them together
// too rather than spelling an absent one as a second way of saying "none".
function paintState(
  rowIndexByValue: Map<string, number>,
  opts?: {
    rowColorsByIndex?: (number | undefined)[]
    hiddenColors?: Set<number>
  },
) {
  return {
    rowIndexByValue,
    rowColorsByIndex: opts?.rowColorsByIndex ?? [],
    hiddenColors: opts?.hiddenColors ?? new Set<number>(),
  }
}

test('maps partition values to global row indices', () => {
  const rowIndexByValue = new Map([
    ['dadHP1', 0],
    ['momHP0', 1],
  ])
  const buffer = buildMultiRowInstanceBuffer(
    region,
    paintState(rowIndexByValue),
  )
  expect(decode(buffer)).toEqual([
    { startBp: 10, endBp: 15, rowIndex: 1, color: 0xff0000ff },
    { startBp: 20, endBp: 25, rowIndex: 0, color: 0xff00ff00 },
    { startBp: 30, endBp: 35, rowIndex: 1, color: 0xffff0000 },
  ])
})

test('skips features whose partition value has no assigned row', () => {
  const rowIndexByValue = new Map([['momHP0', 0]])
  const buffer = buildMultiRowInstanceBuffer(
    region,
    paintState(rowIndexByValue),
  )
  expect(decode(buffer).map(d => d.startBp)).toEqual([10, 30])
})

test('skips features whose color is a hidden category', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 0],
    ['dadHP1', 1],
  ])
  // hide 0xff00ff00 (feature 1, on dadHP1); features 0 and 2 remain
  const buffer = buildMultiRowInstanceBuffer(
    region,
    paintState(rowIndexByValue, { hiddenColors: new Set([0xff00ff00]) }),
  )
  expect(decode(buffer).map(d => d.startBp)).toEqual([10, 30])
})

test('a hidden category does not drop features on rows with a color override', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 0],
    ['dadHP1', 1],
  ])
  // row 0 (momHP0) is recolored, so it paints the override, not its baked color.
  // hiding 0xff0000ff (feature 0's baked color) must NOT drop feature 0 — that
  // color is not what the row paints and isn't in the legend.
  const buffer = buildMultiRowInstanceBuffer(
    region,
    paintState(rowIndexByValue, {
      rowColorsByIndex: [0xff123456, undefined],
      hiddenColors: new Set([0xff0000ff]),
    }),
  )
  expect(decode(buffer).map(d => d.startBp)).toEqual([10, 20, 30])
})

test('rowColorsByIndex overrides the baked color for that row only', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 0],
    ['dadHP1', 1],
  ])
  // override row 0 (momHP0) only; row 1 keeps its baked feature color
  const buffer = buildMultiRowInstanceBuffer(
    region,
    paintState(rowIndexByValue, { rowColorsByIndex: [0xff123456, undefined] }),
  )
  expect(decode(buffer).map(d => d.color)).toEqual([
    0xff123456, // feature 0, row 0 -> overridden
    0xff00ff00, // feature 1, row 1 -> baked
    0xff123456, // feature 2, row 0 -> overridden
  ])
})
