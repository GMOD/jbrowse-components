import { ROW_TABLE_MAX_WIDTH } from '../shaders/rowTable.generated.ts'
import {
  HIDDEN_ROW,
  NO_ROW_COLOR,
  RowKeys,
  buildRowTable,
  rowTablePlaneHeight,
  rowTableWidth,
} from './rowTable.ts'

import type { RowTable } from './rowTable.ts'

// The texel the shader samples for `key` on each plane, read back the way
// `rowTable.slang` decodes it.
function texel(table: RowTable, key: number, plane: 'slot' | 'color') {
  const { bytes, width, height } = table.texture
  const x = key % width
  const y = Math.floor(key / width) + (plane === 'color' ? height / 2 : 0)
  const o = (y * width + x) * 4
  return [bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!]
}

function slotOf(table: RowTable, key: number) {
  const [r, g, b, a] = texel(table, key, 'slot')
  return a === 0 ? HIDDEN_ROW : r! | (g! << 8) | (b! << 16)
}

function colorOf(table: RowTable, key: number) {
  const [r, g, b, a] = texel(table, key, 'color')
  return (r! | (g! << 8) | (b! << 16) | (a! << 24)) >>> 0
}

test('each key texel holds its slot, hidden as alpha 0, and its colour override', () => {
  const table = buildRowTable(
    Uint32Array.of(2, HIDDEN_ROW, 0, 0x123456),
    Uint32Array.of(NO_ROW_COLOR, 0xff0000ff, 0x80112233, NO_ROW_COLOR),
  )
  expect(table.keys).toBe(4)
  expect(table.texture).toMatchObject({ width: 4, height: 2 })
  expect([0, 1, 2, 3].map(k => slotOf(table, k))).toEqual([
    2,
    HIDDEN_ROW,
    0,
    0x123456,
  ])
  expect([0, 1, 2, 3].map(k => colorOf(table, k))).toEqual([
    NO_ROW_COLOR,
    0xff0000ff,
    0x80112233,
    NO_ROW_COLOR,
  ])
  expect(texel(table, 1, 'slot')).toEqual([0, 0, 0, 0])
})

test('keys past the width wrap onto further rows of each plane', () => {
  const keys = ROW_TABLE_MAX_WIDTH + 3
  const slot = Uint32Array.from({ length: keys }, (_, k) => keys - 1 - k)
  const color = Uint32Array.from({ length: keys }, (_, k) => 0xff000000 | k)
  const table = buildRowTable(slot, color)
  expect(rowTableWidth(keys)).toBe(ROW_TABLE_MAX_WIDTH)
  expect(rowTablePlaneHeight(keys)).toBe(2)
  expect(table.texture).toMatchObject({ width: ROW_TABLE_MAX_WIDTH, height: 4 })
  for (const k of [0, ROW_TABLE_MAX_WIDTH - 1, ROW_TABLE_MAX_WIDTH, keys - 1]) {
    expect(slotOf(table, k)).toBe(slot[k])
    expect(colorOf(table, k)).toBe(color[k])
  }
})

test('an empty table is one texel per plane', () => {
  expect(buildRowTable(new Uint32Array(0)).texture).toMatchObject({
    width: 1,
    height: 2,
  })
})

test('a slot the 24 bits cannot hold, or a colour lane of another length, is refused', () => {
  expect(() => buildRowTable(Uint32Array.of(0x1000000))).toThrow(
    /slot 16777216/,
  )
  expect(() => buildRowTable(Uint32Array.of(0, 1), Uint32Array.of(0))).toThrow(
    /2 slots but 1 colours/,
  )
})

test('a name keeps the key it was first given, whatever arrives after it', () => {
  const keys = new RowKeys()
  expect(keys.keyOf('mom')).toBe(0)
  expect(keys.keyOf('dad')).toBe(1)
  expect(keys.keyOf('mom')).toBe(0)
  expect(keys.keyOf('aunt')).toBe(2)
  expect(keys.names).toEqual(['mom', 'dad', 'aunt'])
  expect(keys.size).toBe(3)
})
