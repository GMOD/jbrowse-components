import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'

import { ARC_COLOR_INTERCHROM } from '../features/arcs/arcColors.ts'
import { READ_COLOR_CATEGORY } from './colorUtils.ts'
import {
  arcSlotsInWindows,
  insertSizeBandInWindows,
  junctionInWindows,
  readCategoriesInWindows,
  readMapqsInWindows,
} from './keyWindows.ts'

const window = keyWindowsOf([
  { displayedRegionIndex: 0, refName: 'chr1', start: 1000, end: 2000 },
])

const reads = new Map([
  [
    '',
    new Map([
      [
        0,
        {
          readPositions: new Uint32Array([100, 200, 1500, 1600, 2500, 2600]),
          readColorCategories: new Uint8Array([
            READ_COLOR_CATEGORY.pairRL,
            READ_COLOR_CATEGORY.normalInsert,
            READ_COLOR_CATEGORY.longInsert,
          ]),
          readMapqs: new Uint8Array([0, 60, 20]),
        },
      ],
    ]),
  ],
])

test('a read keys only where it touches a window of its region', () => {
  expect(readCategoriesInWindows(reads, window)).toEqual(
    new Set(['normalInsert']),
  )
  expect(readMapqsInWindows(reads, window)).toEqual(new Set(['60']))
  expect(
    readCategoriesInWindows(
      reads,
      keyWindowsOf([
        { displayedRegionIndex: 1, refName: 'chr1', start: 0, end: 3000 },
      ]),
    ),
  ).toEqual(new Set())
})

test('an arc keys by its span, a tick by its foot, a cross-region arc by either region', () => {
  const region = {
    numArcs: 2,
    arcX1: new Uint32Array([500, 2100]),
    arcX2: new Uint32Array([2500, 2900]),
    arcColorTypes: new Uint8Array([4, 5]),
    numArcLines: 2,
    arcLinePositions: new Uint32Array([900, 1200]),
  }
  const crossing = { colorType: 6, p1RegionIndex: 3, p2RegionIndex: 0 }
  const result = {
    byGroup: new Map([['', new Map([[0, region]])]]),
    crossRegionByGroup: new Map([['', [crossing]]]),
  }
  expect(arcSlotsInWindows(result, window)).toEqual(
    new Set([4, ARC_COLOR_INTERCHROM, 6]),
  )

  const offscreenTick = {
    ...region,
    numArcs: 0,
    arcLinePositions: new Uint32Array([900, 2100]),
  }
  expect(
    arcSlotsInWindows(
      {
        ...result,
        byGroup: new Map([['', new Map([[0, offscreenTick]])]]),
        crossRegionByGroup: new Map(),
      },
      window,
    ),
  ).toEqual(new Set())
})

test('a junction keys where its span touches a window on its reference', () => {
  expect(
    junctionInWindows({ refName: 'chr1', start: 1900, end: 5000 }, window),
  ).toBe(true)
  expect(
    junctionInWindows({ refName: 'chr2', start: 1900, end: 5000 }, window),
  ).toBe(false)
  expect(
    junctionInWindows({ refName: 'chr1', start: 2000, end: 5000 }, window),
  ).toBe(false)
})

test('a key states the insert-size band only where every region in view shares one', () => {
  const band = { lower: 150, upper: 600 }
  const regions = (
    ...bands: ({ lower: number; upper: number } | undefined)[]
  ) =>
    new Map([['', new Map(bands.map((b, i) => [i, { insertSizeStats: b }]))]])
  const both = keyWindowsOf([
    { displayedRegionIndex: 0, refName: 'chr1', start: 0, end: 10 },
    { displayedRegionIndex: 1, refName: 'chr2', start: 0, end: 10 },
  ])
  expect(insertSizeBandInWindows(regions(band, band), both)).toEqual(band)
  expect(
    insertSizeBandInWindows(regions(band, { lower: 100, upper: 600 }), both),
  ).toBeUndefined()
  expect(
    insertSizeBandInWindows(regions(band, undefined), both),
  ).toBeUndefined()
  expect(
    insertSizeBandInWindows(regions(band, { lower: 100, upper: 600 }), window),
  ).toEqual(band)
})
