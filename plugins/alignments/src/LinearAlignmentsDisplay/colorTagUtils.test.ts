import { getQueryColor, refNamePaletteColorAt } from '@jbrowse/core/ui/colors'

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

// Chromosome painting resolves through `refNameColor`, so the legend swatch
// matches what buildReadTagColors bakes into the reads — and matches what the
// synteny view's Query mode paints the same contig, which is the whole reason
// the rule lives in core.
test('a refName takes its assembly position, not a hash of its name', () => {
  const positions = new Map([
    ['chr1', 0],
    ['chr12', 11],
    ['chr21', 20],
    ['chrY', 23],
  ])
  const at = (name: string) =>
    bakedValueColor(MATE, name, n => positions.get(n))
  expect(at('chr1')).toBe(refNamePaletteColorAt(0))
  expect(at('chr12')).toBe(refNamePaletteColorAt(11))

  // The bug this rule replaced, stated as the property it broke: category10
  // hashes all four of these onto ONE colour, so from a chr1 view a
  // translocation to chr12, chr21 or chrY painted the colour of the reads
  // around it. Held against `getQueryColor` rather than a literal, so it is
  // still the old rule being described and not a copied hex.
  const hashed = [...positions.keys()].map(getQueryColor)
  expect(new Set(hashed).size).toBe(1)
  expect(new Set([...positions.keys()].map(at)).size).toBe(4)
})

// The order is not always available — an assembly still loading, or a scaffold
// the assembly does not list. A stable arbitrary colour beats no colour, so the
// hash stays as the fallback and every other property here still holds over it.
test('a refName with no known position falls back to a stable color', () => {
  const unplaced = (name: string) =>
    bakedValueColor(MATE, name, () => undefined)
  expect(unplaced('ctgA')).toBe(bakedValueColor(MATE, 'ctgA'))
  expect(unplaced('ctgA')).not.toBe(unplaced('ctgB'))
})

// The one thing that is NOT a function of the value alone, and the model test
// that used to cover it: the scheme picks which function runs, so the same
// string paints differently under chromosome painting than under a tag.
test('the scheme, not the value, is what changes a color', () => {
  expect(bakedValueColor(MATE, 'ctgA')).not.toBe(tagColor('ctgA'))
})
