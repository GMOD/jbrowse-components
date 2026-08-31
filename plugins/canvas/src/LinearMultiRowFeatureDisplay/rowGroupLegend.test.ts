import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// Rows only — the group key is about the sidebar stripe, not about what is
// painted on the rows.
function rows(n: number): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    partitionValues: Array.from({ length: n }, (_, i) => `dog${i}`),
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    partitionCandidates: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// Three declared groups over the cohort, the shape a `rowGroups` config takes.
const ROW_GROUPS = [
  { match: '^dog[0-2]?[0-9]$', group: 'Village dog', color: '#e41a1c' },
  { match: '^dog[3-5][0-9]$', group: 'Wolf', color: '#377eb8' },
  { match: '^dog', group: 'Breed', color: '#4daf4a' },
]

function makeDisplay(n: number, height: number, rowGroups = ROW_GROUPS) {
  const { createDisplay } = createTestEnvironment({
    displayConfig: { rowGroups },
  })
  const { display } = createDisplay()
  display.setRpcData(0, rows(n))
  display.setRowHeight(0)
  display.setHeight(height)
  return display
}

// The case this exists for: 1,987 canids in 640px is 0.32px a row, where
// RowLabelsOverlay drops to an unlabelled swatch and the stripe's colors are
// the only thing left saying which rows are which.
it('keys the group stripe when the rows are too short to name themselves', () => {
  const display = makeDisplay(1987, 640)
  expect(display.effectiveRowHeight).toBeLessThan(6)
  expect(display.rowGroupLegend).toEqual([
    { color: '#e41a1c', label: 'Village dog' },
    { color: '#377eb8', label: 'Wolf' },
    { color: '#4daf4a', label: 'Breed' },
  ])
})

// Above the threshold every row writes its own name beside it, so the key would
// restate what is already on screen.
it('draws no key while the rows carry their own labels', () => {
  const display = makeDisplay(20, 600)
  expect(display.effectiveRowHeight).toBeGreaterThanOrEqual(6)
  expect(display.rowGroupLegend).toEqual([])
})

// One group is every row the same color: a key naming it distinguishes nothing.
it('draws no key for a single group', () => {
  const display = makeDisplay(1987, 640, [
    { match: '^dog', group: 'Canid', color: '#e41a1c' },
  ])
  expect(display.rowGroupLegend).toEqual([])
})

// No rowGroups at all is the ordinary track: nothing tints the stripe.
it('draws no key when nothing is grouped', () => {
  expect(makeDisplay(1987, 640, []).rowGroupLegend).toEqual([])
})

// `showRowLabels` takes the whole of SvgRowLabels with it, swatch runs
// included -- it is not a text-only toggle. Keying a stripe nobody drew is the
// inverse of the tall-rows case and comes from the same question being asked
// about only half of what draws it.
it('draws no key once the row labels the stripe lives in are turned off', () => {
  const display = makeDisplay(1987, 640)
  expect(display.rowGroupLegend).toHaveLength(3)

  display.setShowRowLabels(false)
  expect(display.rowGroupLegend).toEqual([])
})
