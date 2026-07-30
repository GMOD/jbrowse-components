import { getQueryColor } from '@jbrowse/core/ui/colors'

import {
  TAG_COLOR_PALETTE,
  updateColorTagMap,
  updateQueryNameColorMap,
} from './colorTagUtils.ts'

// Values stream in as regions load, so a color derived from discovery order made
// a track's colors depend on which read arrived first. Every test here pins the
// property that replaced it: the color is a function of the value alone.
// Haplotypes are numbered from 1, so HP:1 takes the leading color and HP:0
// (unphased) the last one rather than sharing a color with a real haplotype.
test('numeric tag values index the palette anchored at 1', () => {
  const n = TAG_COLOR_PALETTE.length
  const { map, added } = updateColorTagMap({}, ['0', '1', '2'])
  expect(added).toBe(true)
  expect(map['1']).toBe(TAG_COLOR_PALETTE[0])
  expect(map['2']).toBe(TAG_COLOR_PALETTE[1])
  expect(map['0']).toBe(TAG_COLOR_PALETTE[n - 1])
})

test('HP:1 and HP:2 keep their colors whatever order they are discovered in', () => {
  const forward = updateColorTagMap({}, ['1', '2']).map
  const reversed = updateColorTagMap({}, ['2', '1']).map
  expect(reversed).toStrictEqual(forward)
  // and a later-discovered third haplotype does not shift the first two
  const withThird = updateColorTagMap(forward, ['0']).map
  expect(withThird['1']).toBe(forward['1'])
  expect(withThird['2']).toBe(forward['2'])
  expect(withThird['0']).toBe(TAG_COLOR_PALETTE[TAG_COLOR_PALETTE.length - 1])
})

test('non-numeric values are stable too, and order-independent', () => {
  const forward = updateColorTagMap({}, ['sampleB', 'sampleA']).map
  const reversed = updateColorTagMap({}, ['sampleA', 'sampleB']).map
  expect(reversed).toStrictEqual(forward)
  // a value seen in a later fetch resolves to the color it already had
  expect(updateColorTagMap({}, ['sampleA']).map.sampleA).toBe(forward.sampleA)
})

test('keeps existing assignments', () => {
  const { map } = updateColorTagMap({ a: 'red' }, ['a'])
  expect(map.a).toBe('red')
})

test('no-op when every value is already mapped', () => {
  const { added } = updateColorTagMap({ '1': TAG_COLOR_PALETTE[1]! }, ['1'])
  expect(added).toBe(false)
})

test('numeric values past the palette length wrap', () => {
  const n = TAG_COLOR_PALETTE.length
  expect(updateColorTagMap({}, [`${n + 1}`]).map[`${n + 1}`]).toBe(
    TAG_COLOR_PALETTE[0],
  )
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
  for (const key of ['toString', 'constructor', 'hasOwnProperty']) {
    expect(TAG_COLOR_PALETTE).toContain(map[key])
  }
})

// Chromosome painting hashes each name through getQueryColor, so the legend
// swatch matches what buildReadTagColors bakes into the reads no matter which
// region discovered the name first.
test('query names take their stable hashed color', () => {
  const { map, added } = updateQueryNameColorMap({}, ['ctgB', 'ctgA'])
  expect(added).toBe(true)
  expect(map.ctgA).toBe(getQueryColor('ctgA'))
  expect(map.ctgB).toBe(getQueryColor('ctgB'))
  expect(updateQueryNameColorMap(map, ['ctgA']).added).toBe(false)
})
