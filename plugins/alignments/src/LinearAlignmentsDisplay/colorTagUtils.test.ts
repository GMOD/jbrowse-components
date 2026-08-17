import { getQueryColor } from '@jbrowse/core/ui/colors'

import { TAG_COLOR_PALETTE, bakedValueColor } from './colorTagUtils.ts'

import type { ColorBy } from '../shared/types.ts'

const TAG: ColorBy = { type: 'tag', tag: 'HP' }
const MATE: ColorBy = { type: 'mateRefName' }
const tagColor = (value: string) => bakedValueColor(TAG, value)

// Values stream in as regions load, so a color derived from discovery order made
// a track's colors depend on which read arrived first. Every test here pins the
// property that replaced it — the color is a function of the value alone — which
// is also what lets the display hold no discovered-value map at all.
//
// Haplotypes are numbered from 1, so HP:1 takes the leading color and HP:0
// (unphased) the last one rather than sharing a color with a real haplotype.
test('numeric tag values index the palette anchored at 1', () => {
  const n = TAG_COLOR_PALETTE.length
  expect(tagColor('1')).toBe(TAG_COLOR_PALETTE[0])
  expect(tagColor('2')).toBe(TAG_COLOR_PALETTE[1])
  expect(tagColor('0')).toBe(TAG_COLOR_PALETTE[n - 1])
})

// The property is now structural — there is no state for an order to be
// recorded in — so this asserts the thing that would break it: a value's color
// must not consult anything but the value.
test('a value resolves the same color whatever else is on screen', () => {
  expect(tagColor('1')).toBe(tagColor('1'))
  expect(tagColor('sampleA')).toBe(tagColor('sampleA'))
  expect(tagColor('1')).not.toBe(tagColor('2'))
})

test('numeric values past the palette length wrap', () => {
  const n = TAG_COLOR_PALETTE.length
  expect(tagColor(`${n + 1}`)).toBe(TAG_COLOR_PALETTE[0])
})

// These used to be a live hazard: the map was probed with `map[value]`, so a
// value naming an Object.prototype member inherited a truthy function and was
// skipped, leaving the read on the no-tag fallback. Without a map there is
// nothing to probe, and the case is only worth a test because the values are
// real ones a tag can carry.
test('values naming prototype members take real colors', () => {
  for (const value of ['toString', 'constructor', 'hasOwnProperty']) {
    expect(TAG_COLOR_PALETTE).toContain(tagColor(value))
  }
})

// Chromosome painting hashes each name through getQueryColor, so the legend
// swatch matches what buildReadTagColors bakes into the reads — the same
// function the synteny view's Query mode paints with.
test('query names take their stable hashed color', () => {
  expect(bakedValueColor(MATE, 'ctgA')).toBe(getQueryColor('ctgA'))
  expect(bakedValueColor(MATE, 'ctgB')).toBe(getQueryColor('ctgB'))
})

// The one thing that is NOT a function of the value alone, and the model test
// that used to cover it: the scheme picks which function runs, so the same
// string paints differently under chromosome painting than under a tag.
test('the scheme, not the value, is what changes a color', () => {
  expect(bakedValueColor(MATE, 'ctgA')).not.toBe(tagColor('ctgA'))
})
