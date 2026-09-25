import { ROW_TABLE_MAX_WIDTH } from '../shaders/rowTable.generated.ts'
import {
  rowTablePlaneHeight,
  rowTableTexelX,
  rowTableTexelY,
  rowTableWidth,
} from '../shaders/rowTable.js.generated.ts'
import { HIDDEN_ROW, NO_ROW_COLOR, RowKeys, buildRowTable } from './rowTable.ts'

import type { RowTable } from './rowTable.ts'

// The texel the shader samples for `key` on each plane, decoded the way
// `rowTable.slang` decodes it, and found by walking the bytes for the one
// texel of the plane that is not blank rather than through the twins the
// builder itself wrote with.
function texelsOf(table: RowTable, plane: 'slot' | 'color') {
  const { bytes, width, height } = table.texture
  const rows = height / 2
  const found: { x: number; y: number; rgba: number[] }[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const o = ((y + (plane === 'color' ? rows : 0)) * width + x) * 4
      const rgba = [bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!]
      if (rgba.some(b => b !== 0)) {
        found.push({ x, y, rgba })
      }
    }
  }
  return found
}

function decodeSlot([r, g, b, a]: number[]) {
  return a === 0 ? HIDDEN_ROW : r! | (g! << 8) | (b! << 16)
}

function decodeColor([r, g, b, a]: number[]) {
  return (r! | (g! << 8) | (b! << 16) | (a! << 24)) >>> 0
}

test('each key texel holds its slot, hidden as alpha 0, and its colour override', () => {
  const table = buildRowTable(
    Uint32Array.of(2, HIDDEN_ROW, 0, 0x123456),
    Uint32Array.of(NO_ROW_COLOR, 0xff0000ff, 0x80112233, NO_ROW_COLOR),
  )
  expect(table.keys).toBe(4)
  expect(table.texture).toMatchObject({ width: 4, height: 2 })
  expect(
    texelsOf(table, 'slot').map(t => [t.x, t.y, decodeSlot(t.rgba)]),
  ).toEqual([
    [0, 0, 2],
    [2, 0, 0],
    [3, 0, 0x123456],
  ])
  expect(
    texelsOf(table, 'color').map(t => [t.x, t.y, decodeColor(t.rgba)]),
  ).toEqual([
    [1, 0, 0xff0000ff],
    [2, 0, 0x80112233],
  ])
})

// The shader's twins name the texel; the bytes have to be where they say, at
// the one width the wrap turns on and past it.
test.each([0, 2047, 2048, 5000])(
  'key %i sits where the shader samples it',
  key => {
    const keys = 5001
    const slot = new Uint32Array(keys).fill(HIDDEN_ROW)
    const color = new Uint32Array(keys)
    slot[key] = 7
    color[key] = 0xff334455
    const table = buildRowTable(slot, color)
    expect(rowTableWidth(keys)).toBe(ROW_TABLE_MAX_WIDTH)
    expect(rowTablePlaneHeight(keys)).toBe(3)
    expect(table.texture).toMatchObject({
      width: ROW_TABLE_MAX_WIDTH,
      height: 6,
    })
    const x = rowTableTexelX(key, keys)
    const y = rowTableTexelY(key, keys)
    expect([x, y]).toEqual([key % 2048, Math.floor(key / 2048)])
    expect(texelsOf(table, 'slot')).toEqual([{ x, y, rgba: [7, 0, 0, 255] }])
    expect(texelsOf(table, 'color')).toEqual([
      { x, y, rgba: [0x55, 0x44, 0x33, 0xff] },
    ])
  },
)

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
  expect(keys.lookup('dad')).toBe(1)
  expect(keys.lookup('uncle')).toBeUndefined()
  expect(keys.names).toEqual(['mom', 'dad', 'aunt'])
  expect(keys.size).toBe(3)
})
