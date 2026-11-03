import {
  KIT,
  recordsCellData,
  recordsDisplayAt,
} from './recordsBand.fixture.ts'

import type * as Band from '@jbrowse/plugin-features/band'

const mockBuilt = { count: 0 }

jest.mock('@jbrowse/plugin-features/band', () => {
  const actual = jest.requireActual<typeof Band>(
    '@jbrowse/plugin-features/band',
  )
  return {
    ...actual,
    buildFeatureFlatbushIndex: (
      ...args: Parameters<typeof actual.buildFeatureFlatbushIndex>
    ) => {
      mockBuilt.count++
      return actual.buildFeatureFlatbushIndex(...args)
    },
  }
})

function settledBand() {
  const { display } = recordsDisplayAt(KIT, 51)
  display.setRecordsHeight(display.recordsStackHeight + 40)
  const first = display.recordsFlatbushIndexes.get(0)
  mockBuilt.count = 0
  return { display, first }
}

// Over rows the band's stack is cut to its height afresh on every change,
// which hands back each region that lost no record as the object it was.
test('a band resize that hides no record rebuilds no hit index', () => {
  const { display, first } = settledBand()
  const before = display.recordsLaidOutDataMap
  display.setRecordsHeight(display.recordsStackHeight + 80)
  expect(display.recordsLaidOutDataMap).not.toBe(before)
  expect(display.recordsFlatbushIndexes.get(0)).toBe(first)
  expect(mockBuilt.count).toBe(0)
})

test('new records rebuild the region they land in', () => {
  const { display, first } = settledBand()
  display.setCellData(recordsCellData(KIT.slice(1)), [0])
  expect(display.recordsFlatbushIndexes.get(0)).not.toBe(first)
  expect(mockBuilt.count).toBe(1)
})
