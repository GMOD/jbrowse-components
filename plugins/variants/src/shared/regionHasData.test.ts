import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

// One RPC serves every region of a fetch and its payload replaces the last one
// whole, while `fetchRegionsBatched` marks loaded only the regions it issued.
// A region an earlier batch loaded therefore keeps its `loadedRegions` entry
// with no data behind it, and read as cache-valid it draws blank when the
// viewport comes back inside its span. `regionHasData` answers off the regions
// the held payload was committed for, so `isCacheValid` refuses that entry.
const REGIONS = [
  { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 5000 },
  { assemblyName: 'volvox', refName: 'ctgA', start: 5000, end: 10_000 },
]

function twoRegionsLoaded() {
  const { display, view } = createTestEnvironment().createDisplay()
  view.setDisplayedRegions(REGIONS)
  display.setLoadedRegion(0, REGIONS[0]!)
  display.setLoadedRegion(1, REGIONS[1]!)
  return display
}

function payload() {
  return { mode: 'regular', perRegionCellData: {} } as unknown as Parameters<
    ReturnType<typeof twoRegionsLoaded>['setCellData']
  >[0]
}

test('a loaded region whose data the last payload replaced is not cache-valid', () => {
  const display = twoRegionsLoaded()
  display.setCellData(payload(), [0, 1])
  expect(display.isCacheValid(0)).toBe(true)
  expect(display.isCacheValid(1)).toBe(true)

  display.setCellData(payload(), [1])
  expect(display.isCacheValid(1)).toBe(true)
  expect(display.isCacheValid(0)).toBe(false)
})

// `regionHasData` records the regions the commit named, not the payload's
// keys: a region with no variants gets no `perRegionCellData` entry, and
// reading that as "no data" would refetch an empty region forever.
test('an empty region the fetch covered stays cache-valid', () => {
  const display = twoRegionsLoaded()
  display.setCellData(payload(), [0, 1])
  expect(display.isCacheValid(0)).toBe(true)
})

test('clearing the payload clears every region', () => {
  const display = twoRegionsLoaded()
  display.setCellData(payload(), [0, 1])
  display.clearDisplaySpecificData()
  expect(display.isCacheValid(0)).toBe(false)
  expect(display.isCacheValid(1)).toBe(false)
})
