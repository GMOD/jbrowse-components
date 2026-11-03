import {
  KIT,
  recordsCellData,
  recordsDisplayAt,
} from './recordsBand.fixture.ts'

function settledBand() {
  const { display } = recordsDisplayAt(KIT, 51)
  display.setRecordsHeight(display.recordsStackHeight + 40)
  const first = display.recordsFlatbushIndexes.get(0)
  expect(first).toBeDefined()
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
})

test('new records rebuild the region they land in', () => {
  const { display, first } = settledBand()
  display.setCellData(recordsCellData(KIT.slice(1)), [0])
  expect(display.recordsFlatbushIndexes.get(0)).not.toBe(first)
})
