import { buildMultiRowInstanceBuffer } from './multiRowInstanceBuffer.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_F32,
} from './shaders/multiRow.generated.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

interface DecodedInstance {
  startBp: number
  endBp: number
  rowIndex: number
  color: number
}

function decode(buffer: ArrayBuffer, count: number): DecodedInstance[] {
  const u32 = new Uint32Array(buffer)
  const out: DecodedInstance[] = []
  for (let i = 0; i < count; i++) {
    const base = i * INSTANCE_STRIDE_F32
    out.push({
      startBp: u32[base + FIELD_OFFSET_F32.startBp]!,
      endBp: u32[base + FIELD_OFFSET_F32.endBp]!,
      rowIndex: u32[base + FIELD_OFFSET_F32.rowIndex]!,
      color: u32[base + FIELD_OFFSET_F32.color]!,
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
}

test('maps partition values to global row indices', () => {
  const rowIndexByValue = new Map([
    ['dadHP1', 0],
    ['momHP0', 1],
  ])
  const { buffer, count } = buildMultiRowInstanceBuffer(region, rowIndexByValue)
  expect(count).toBe(3)
  expect(decode(buffer, count)).toEqual([
    { startBp: 10, endBp: 15, rowIndex: 1, color: 0xff0000ff },
    { startBp: 20, endBp: 25, rowIndex: 0, color: 0xff00ff00 },
    { startBp: 30, endBp: 35, rowIndex: 1, color: 0xffff0000 },
  ])
})

test('skips features whose partition value has no assigned row', () => {
  const rowIndexByValue = new Map([['momHP0', 0]])
  const { buffer, count } = buildMultiRowInstanceBuffer(region, rowIndexByValue)
  expect(count).toBe(2)
  expect(decode(buffer, count).map(d => d.startBp)).toEqual([10, 30])
})

test('rowColorsByIndex overrides the baked color for that row only', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 0],
    ['dadHP1', 1],
  ])
  // override row 0 (momHP0) only; row 1 keeps its baked feature color
  const { buffer, count } = buildMultiRowInstanceBuffer(
    region,
    rowIndexByValue,
    [0xff123456, undefined],
  )
  expect(decode(buffer, count).map(d => d.color)).toEqual([
    0xff123456, // feature 0, row 0 -> overridden
    0xff00ff00, // feature 1, row 1 -> baked
    0xff123456, // feature 2, row 0 -> overridden
  ])
})
