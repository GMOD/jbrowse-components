import { getQueryColor } from '@jbrowse/core/ui/colors'

import {
  TAG_COLOR_PALETTE,
  updateColorTagMap,
  updateQueryNameColorMap,
} from './colorTagUtils.ts'

test('assigns palette colors to new tag values', () => {
  const { map, added } = updateColorTagMap({}, ['a', 'b', 'a'])
  expect(added).toBe(true)
  expect(map.a).toBe(TAG_COLOR_PALETTE[0])
  expect(map.b).toBe(TAG_COLOR_PALETTE[1])
})

test('keeps existing assignments and continues the palette index', () => {
  const { map, added } = updateColorTagMap({ a: TAG_COLOR_PALETTE[0]! }, [
    'a',
    'c',
  ])
  expect(added).toBe(true)
  expect(map.a).toBe(TAG_COLOR_PALETTE[0])
  expect(map.c).toBe(TAG_COLOR_PALETTE[1])
})

test('no-op when every value is already mapped', () => {
  const { added } = updateColorTagMap({ a: TAG_COLOR_PALETTE[0]! }, ['a'])
  expect(added).toBe(false)
})

test('wraps the palette once more values than colors are seen', () => {
  const values = Array.from(
    { length: TAG_COLOR_PALETTE.length + 1 },
    (_, i) => `tag:${i}`,
  )
  const { map } = updateColorTagMap({}, values)
  expect(map[`tag:${TAG_COLOR_PALETTE.length}`]).toBe(TAG_COLOR_PALETTE[0])
})

// Tag values colliding with Object.prototype member names must still get a real
// palette color rather than being skipped because `map['toString']` inherits a
// truthy function.
test('assigns colors to prototype-name tag values', () => {
  const { map, added } = updateColorTagMap({}, [
    'toString',
    'constructor',
    'hasOwnProperty',
  ])
  expect(added).toBe(true)
  expect(map.toString).toBe(TAG_COLOR_PALETTE[0])
  expect(map.constructor).toBe(TAG_COLOR_PALETTE[1])
  expect(map.hasOwnProperty).toBe(TAG_COLOR_PALETTE[2])
})

// Chromosome painting hashes each name instead of taking the next palette slot,
// so the legend swatch matches what buildReadTagColors bakes into the reads no
// matter which region discovered the name first.
test('query names take their stable hashed color, not a discovery-order slot', () => {
  const { map, added } = updateQueryNameColorMap({}, ['ctgB', 'ctgA'])
  expect(added).toBe(true)
  expect(map.ctgA).toBe(getQueryColor('ctgA'))
  expect(map.ctgB).toBe(getQueryColor('ctgB'))
  expect(updateQueryNameColorMap(map, ['ctgA']).added).toBe(false)
})
