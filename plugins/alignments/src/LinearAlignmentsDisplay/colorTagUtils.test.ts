import {
  getQueryColor,
  hashString,
  refNamePaletteColorAt,
} from '@jbrowse/core/ui/colors'

import { TAG_PALETTE, undeclaredValueColor } from './colorTagUtils.ts'

const TAG = 'tags.HP'
const MATE = 'mateRefName'
const dealt = () => undeclaredValueColor(TAG, undefined, new Map())
const hashed = (value: string) =>
  TAG_PALETTE[hashString(value) % TAG_PALETTE.length]

// Haplotypes are numbered from 1, so HP:1 takes the leading color and HP:0
// (unphased) the far end rather than sharing a color with a real haplotype.
test('integer tag values take the slot they name, anchored at 1', () => {
  const color = dealt()
  expect(color('1')).toBe(TAG_PALETTE[0])
  expect(color('2')).toBe(TAG_PALETTE[1])
  expect(color('0')).toBe(TAG_PALETTE.at(-1))
})

// Ten slots wrapped NM:10 onto NM:0.
test('NM 0 and NM 10 take different colors', () => {
  const color = dealt()
  expect(color('0')).not.toBe(color('10'))
})

test('values met together take apart colors where their hashes collide', () => {
  const values = ['HG005', 'RG1', 'HG006', 'RG2']
  expect(new Set(values.map(hashed)).size).toBe(2)
  const color = dealt()
  expect(new Set(values.map(color)).size).toBe(values.length)
})

test('a value nothing collides with paints the slot its hash names', () => {
  expect(dealt()('sampleA')).toBe(hashed('sampleA'))
})

test('a value keeps its color as others arrive', () => {
  const color = dealt()
  const first = color('RG1')
  color('HG005')
  color('HG006')
  expect(color('RG1')).toBe(first)
})

test('every scale handed one held map agrees on a collided pair', () => {
  const held = new Map<string, number>()
  undeclaredValueColor(TAG, undefined, held)('RG1')
  const later = undeclaredValueColor(TAG, undefined, held)
  expect(later('RG1')).toBe(hashed('RG1'))
  expect(later('HG005')).not.toBe(hashed('HG005'))
})

test('values naming prototype members take real colors', () => {
  const color = dealt()
  for (const value of ['toString', 'constructor', 'hasOwnProperty']) {
    expect(TAG_PALETTE).toContain(color(value))
  }
})

// Chromosome painting resolves through `refNameColor`, so the swatch matches
// what the bake paints and what the synteny view's Query mode paints the same
// contig.
test('a refName takes its assembly position, not a hash of its name', () => {
  const positions = new Map([
    ['chr1', 0],
    ['chr12', 11],
    ['chr21', 20],
    ['chrY', 23],
  ])
  const at = undeclaredValueColor(MATE, n => positions.get(n))
  expect(at('chr1')).toBe(refNamePaletteColorAt(0))
  expect(at('chr12')).toBe(refNamePaletteColorAt(11))

  // category10 hashes all four onto one color, so from a chr1 view a
  // translocation to chr12, chr21 or chrY painted the color of the reads
  // around it.
  const hashedNames = [...positions.keys()].map(getQueryColor)
  expect(new Set(hashedNames).size).toBe(1)
  expect(new Set([...positions.keys()].map(at)).size).toBe(4)
})

test('a refName with no known position falls back to a stable color', () => {
  const unplaced = undeclaredValueColor(MATE, () => undefined)
  expect(unplaced('ctgA')).toBe(undeclaredValueColor(MATE)('ctgA'))
  expect(unplaced('ctgA')).not.toBe(unplaced('ctgB'))
})

test('the field picks the rule, so one string paints differently per field', () => {
  expect(undeclaredValueColor(MATE)('ctgA')).not.toBe(dealt()('ctgA'))
})
