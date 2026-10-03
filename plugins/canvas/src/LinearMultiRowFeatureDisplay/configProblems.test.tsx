import { render, screen } from '@testing-library/react'

import LinearMultiRowFeatureDisplayComponent from './components/LinearMultiRowFeatureDisplayComponent.tsx'
import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

test('a threshold range that does not fit its cuts shows as a notice', () => {
  const { display } = createTestEnvironment({
    displayConfig: {
      color: {
        field: 'segmean',
        scale: 'threshold',
        domain: ['-1', '1'],
        range: ['blue', 'red'],
      },
    },
  }).createDisplay()
  expect(display.notices).toEqual([
    expect.stringMatching(/^color\.range: 2 threshold cuts make 3 intervals/),
  ])
  render(<LinearMultiRowFeatureDisplayComponent model={display} />)
  expect(screen.getByText('1 config problem')).toBeTruthy()
})

function rows(names: string[]): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    rectColorValues: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    rowValues: names,
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

test('a facet on a field no loaded row carries is a notice', () => {
  const notices = (displayConfig: Record<string, unknown>, loaded = true) => {
    const { display } = createTestEnvironment({ displayConfig }).createDisplay()
    if (loaded) {
      display.setRpcData(0, rows(['CLUPGR000001', 'COLL000001']), ctgA)
    }
    return display.notices
  }
  const wolf = [{ match: '^CLUP', group: 'Wolf' }]
  expect(notices({ facet: 'strand' })).toEqual([
    'facet.field: no row carries strand, so it bands nothing',
  ])
  expect(notices({ facet: 'group' })).toEqual([
    'facet.field: no row carries group, so it bands nothing',
  ])
  expect(notices({ facet: 'group', rowGroups: wolf })).toEqual([])
  expect(notices({ facet: 'name' })).toEqual([])
  expect(notices({ facet: 'strand' }, false)).toEqual([])
})
