import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'

import { cellPayloadOf, featureInfoOf } from '../shared/cellDataFixtures.ts'
import {
  CELL_ALT,
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
      featureCategories: Uint8Array.from([
        ALT,
        ALT | NO_CALL | (1 << CELL_ALT_SECONDARY) | (1 << CELL_UNPHASED),
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
  expect(keyed.hasSecondaryAlt).toBe(false)
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
  expect(keyed.hasSecondaryAlt).toBe(true)
  expect(keyed.hasUnphased).toBe(true)
  expect(keyed.altColorValues).toEqual(['HIGH', 'LOW'])
  expect(keyed.svTypes).toEqual(['DEL', 'INV'])
})
