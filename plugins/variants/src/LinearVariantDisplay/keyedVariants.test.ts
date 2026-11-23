import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'

import { cellPayloadOf, featureInfoOf } from '../shared/cellData.fixture.ts'
import {
  ALLELE_SLOT_BIT,
  CELL_ALT,
  CELL_ALT_FOLDED,
  CELL_ALT_SECONDARY,
  CELL_NO_CALL,
  CELL_UNPHASED,
} from '../shared/variantCellStyles.ts'
import {
  keyedVariantsFetched,
  keyedVariantsInWindows,
} from './keyedVariants.ts'

const REF_ONLY = 1
const ALT = 1 << CELL_ALT
const NO_CALL = 1 << CELL_NO_CALL
// the bits a cell in allele slot `slot`, past the first, paints
const SLOT = (slot: number) =>
  (1 << CELL_ALT_SECONDARY) | (1 << (ALLELE_SLOT_BIT + slot))

// on screen: chr1:1000-2000 of displayed region 0
const windows = keyWindowsOf([
  { displayedRegionIndex: 0, refName: 'chr1', start: 1000, end: 2000 },
])

// three variants: one on screen, one in the fetch buffer to the left and one
// that starts left of the window and reaches into it
function region() {
  return cellPayloadOf(
    [
      featureInfoOf('onScreen', { svType: 'DEL' }),
      featureInfoOf('buffered', { svType: 'INV' }),
      featureInfoOf('reachesIn'),
    ],
    {
      featurePositions: Uint32Array.from([1500, 1501, 500, 501, 900, 1100]),
      featureCategories: Uint16Array.from([
        ALT,
        ALT | NO_CALL | SLOT(1) | (1 << CELL_UNPHASED),
        REF_ONLY,
      ]),
      featureColorValues: Uint32Array.from([1, 2, 3]),
      colorValues: ['HIGH', 'LOW', 'MODIFIER'],
    },
  )
}

test('a category painted only off screen keys nothing', () => {
  const keyed = keyedVariantsInWindows({ 0: region() }, windows)
  expect(keyed.hasNoCall).toBe(false)
  expect(keyed.secondaryAlts).toEqual([])
  expect(keyed.hasUnphased).toBe(false)
})

test('the alt domain lists only the alt-painting variants on screen', () => {
  const keyed = keyedVariantsInWindows({ 0: region() }, windows)
  expect(keyed.altColorValues).toEqual(['HIGH'])
})

test('the record domain and SV classes list every variant touching the window', () => {
  const keyed = keyedVariantsInWindows({ 0: region() }, windows)
  expect(keyed.recordColorValues).toEqual(['HIGH', 'MODIFIER'])
  expect(keyed.svTypes).toEqual(['DEL'])
})

test('a region with no window on screen keys nothing', () => {
  const keyed = keyedVariantsInWindows({ 1: region() }, windows)
  expect(keyed.recordColorValues).toEqual([])
  expect(keyed.hasNoCall).toBe(false)
})

test('a fetch that is what is shown keys every variant', () => {
  const keyed = keyedVariantsFetched([region()])
  expect(keyed.hasNoCall).toBe(true)
  expect(keyed.secondaryAlts.map(a => a.slot)).toEqual([1])
  expect(keyed.hasUnphased).toBe(true)
  expect(keyed.altColorValues).toEqual(['HIGH', 'LOW'])
  expect(keyed.svTypes).toEqual(['DEL', 'INV'])
})

// rice Pup1's shape: <X:1> the commonest of four carried alts, ALEN reference
// first
const pup1 = featureInfoOf('pup1', {
  ref: 'N',
  alt: ['<X:1>', '<X:2>', '<X:3>', '<X:4>'],
  altOrder: ['1', '4', '2', '3'],
  alleleBp: [39, 39, 53149, 46260, 88924],
})
const PUP1_PAINTED = ALT | SLOT(1) | SLOT(2) | SLOT(3)

function keyedOf(records: [ReturnType<typeof featureInfoOf>, number][]) {
  return keyedVariantsFetched([
    cellPayloadOf(
      records.map(([info]) => info),
      {
        featureCategories: Uint16Array.from(records.map(([, bits]) => bits)),
        featurePositions: Uint32Array.from(records.flatMap(() => [10, 11])),
      },
    ),
  ])
}

test('the one multiallelic record on screen names the allele each hue stands for', () => {
  const keyed = keyedOf([[pup1, PUP1_PAINTED]])
  expect(keyed.primaryAltName).toBe('<X:1>, 39 bp path')
  expect(keyed.secondaryAlts).toEqual([
    { slot: 1, name: '<X:4>, 88,924 bp path' },
    { slot: 2, name: '<X:2>, 53,149 bp path' },
    { slot: 3, name: '<X:3>, 46,260 bp path' },
  ])
})

test('where two records paint hues past the first, the key names no allele', () => {
  const snv = featureInfoOf('snv')
  const triallelic = featureInfoOf('tri', {
    alt: ['G', 'C'],
    altOrder: ['2', '1'],
  })
  const keyed = keyedOf([
    [pup1, PUP1_PAINTED],
    [snv, ALT],
    [triallelic, ALT | SLOT(1)],
  ])
  expect(keyed.primaryAltName).toBeUndefined()
  expect(keyed.secondaryAlts).toEqual([{ slot: 1 }, { slot: 2 }, { slot: 3 }])
})

// rice qSW5's shape: one multiallelic record among biallelic neighbours
test('biallelic neighbours sharing the first hue leave the one multiallelic record named past it', () => {
  const keyed = keyedOf([
    [featureInfoOf('left'), ALT],
    [pup1, PUP1_PAINTED],
    [featureInfoOf('right'), ALT],
  ])
  expect(keyed.primaryAltName).toBeUndefined()
  expect(keyed.secondaryAlts).toEqual([
    { slot: 1, name: '<X:4>, 88,924 bp path' },
    { slot: 2, name: '<X:2>, 53,149 bp path' },
    { slot: 3, name: '<X:3>, 46,260 bp path' },
  ])
})

test('sequence alleles of near lengths read apart, by ALT index and exact length', () => {
  const ref = 'A'.repeat(2419)
  const keyed = keyedOf([
    [
      featureInfoOf('vntr', {
        ref,
        alt: ['A'.repeat(2391), 'A'.repeat(2393), 'C'.repeat(2419), 'A'],
        altOrder: ['3', '1', '2', '4'],
      }),
      ALT | SLOT(1) | SLOT(2) | SLOT(3),
    ],
  ])
  const names = [keyed.primaryAltName, ...keyed.secondaryAlts.map(a => a.name)]
  expect(names).toEqual([
    'ALT 3, 2,419 bp (0 bp)',
    'ALT 1, 2,391 bp (-28 bp)',
    'ALT 2, 2,393 bp (-26 bp)',
    'ALT 4, 1 bp (-2,418 bp)',
  ])
  expect(new Set(names).size).toBe(names.length)
})

test('a biallelic record names no allele', () => {
  const keyed = keyedOf([[featureInfoOf('snv'), ALT]])
  expect(keyed.primaryAltName).toBeUndefined()
  expect(keyed.secondaryAlts).toEqual([])
})

test('no hue names an allele where a record folds its rarest into the last', () => {
  const keyed = keyedOf([
    [
      featureInfoOf('str', {
        alt: Array.from({ length: 12 }, (_, i) => `<X:${i + 1}>`),
        altOrder: Array.from({ length: 12 }, (_, i) => String(i + 1)),
      }),
      ALT | SLOT(1) | SLOT(7) | (1 << CELL_ALT_FOLDED),
    ],
  ])
  expect(keyed.secondaryAlts).toEqual([{ slot: 1 }, { slot: 7 }])
})

test('a spanning deletion is named as one, with no length', () => {
  const keyed = keyedOf([
    [
      featureInfoOf('overlapped', {
        alt: ['T', '*'],
        altOrder: ['1', '2'],
        alleleBp: [1, 1, 1],
      }),
      ALT | SLOT(1),
    ],
  ])
  expect(keyed.secondaryAlts).toEqual([{ slot: 1, name: 'spanning deletion' }])
})

test('a record shown in two displayed regions still names its alleles', () => {
  const payload = () =>
    cellPayloadOf([pup1], {
      featureCategories: Uint16Array.from([PUP1_PAINTED]),
      featurePositions: Uint32Array.from([1500, 1501]),
    })
  const keyed = keyedVariantsInWindows(
    { 0: payload(), 1: payload() },
    keyWindowsOf([
      { displayedRegionIndex: 0, refName: 'chr1', start: 1000, end: 2000 },
      { displayedRegionIndex: 1, refName: 'chr1', start: 1000, end: 2000 },
    ]),
  )
  expect(keyed.primaryAltName).toBe('<X:1>, 39 bp path')
  expect(keyed.secondaryAlts.map(a => a.name)).toEqual([
    '<X:4>, 88,924 bp path',
    '<X:2>, 53,149 bp path',
    '<X:3>, 46,260 bp path',
  ])
})
