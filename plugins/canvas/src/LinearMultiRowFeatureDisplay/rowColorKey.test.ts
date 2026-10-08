import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function rows(n: number): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    rectColorValues: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    rowValues: Array.from({ length: n }, (_, i) => `dog${i}`),
    featureRowValueIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    rowsFieldCandidates: [],
    rowsFieldCandidateValues: [],
    legendCandidates: [],
    resolvedRowsField: 'name',
  }
}

const ROW_GROUPS = [
  { match: '^dog[0-2]?[0-9]$', group: 'Village dog' },
  { match: '^dog[3-5][0-9]$', group: 'Wolf' },
]

const BY_GROUP = {
  field: 'group',
  domain: ['Village dog', 'Wolf'],
  range: ['#e41a1c', '#377eb8'],
}

function makeDisplay(n: number, height: number, rowColor: unknown = BY_GROUP) {
  const { createDisplay } = createTestEnvironment({
    displayConfig: { rowGroups: ROW_GROUPS, rowColor },
  })
  const { display } = createDisplay()
  display.setRpcData(0, rows(n), ctgA)
  display.setRowHeight(0)
  display.setHeight(height)
  return display
}

const rowColorKey = (display: ReturnType<typeof makeDisplay>) =>
  display.legendSpec.sections.find(s => s.id === 'rowColor')?.items ?? []

// dog60 and up match no rule, so they carry no group and take no entry.
it('keys the group colors at any row height', () => {
  for (const height of [640, 60_000]) {
    expect(rowColorKey(makeDisplay(80, height))).toEqual([
      { value: 'Village dog', label: 'Village dog', color: '#e41a1c' },
      { value: 'Wolf', label: 'Wolf', color: '#377eb8' },
    ])
  }
})

it('draws no key by name, whose labels are the key', () => {
  expect(rowColorKey(makeDisplay(80, 640, 'name'))).toEqual([])
})

it('focuses the clicked group', () => {
  const display = makeDisplay(80, 640)
  display.focusLegendEntry('rowColor', 'Wolf')
  expect(display.sources.map(s => s.name)).toEqual(
    Array.from({ length: 30 }, (_, i) => `dog${i + 30}`),
  )
})
