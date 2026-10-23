import { collectLegendCandidates } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

interface Feat {
  transcript: string
  domain: string
  start: number
}

// One feature per domain, each 50bp, rows by transcript, colored by domain.
function region(feats: Feat[]) {
  const rowValues = [...new Set(feats.map(f => f.transcript))]
  const values = [...new Set(feats.map(f => f.domain))]
  const featureRowValueIndex = Uint32Array.from(feats, f =>
    rowValues.indexOf(f.transcript),
  )
  const rectColorValues = Uint32Array.from(
    feats,
    f => values.indexOf(f.domain) + 1,
  )
  const packed = {
    featureStarts: Uint32Array.from(feats, f => f.start),
    featureEnds: Uint32Array.from(feats, f => f.start + 50),
    featureColors: new Uint32Array(feats.length),
    rectColorValues,
    colorValues: {
      field: 'domain',
      values,
      painted: feats.map((_, i) => ({
        rowIndex: featureRowValueIndex[i]!,
        valueIndex: rectColorValues[i]! - 1,
      })),
    },
    rowValues,
    featureRowValueIndex,
    featureNames: feats.map(f => f.domain),
    featureIds: feats.map((_, i) => `f${i}`),
    usedItemRgb: false,
    fieldNames: ['transcript', 'domain'],
    rowsFieldCandidateValues: [],
    resolvedRowsField: 'transcript',
  }
  return {
    ...packed,
    legendCandidates: collectLegendCandidates(packed),
  } satisfies MultiRowRegionData
}

function setup() {
  const { display, view } = createTestEnvironment({
    displayConfig: {
      rows: { field: 'transcript' },
      encoding: { color: { field: 'domain' } },
    },
  }).createDisplay()
  const onScreen = Math.floor(view.pxToBp(100).coord0)
  const offScreen = Math.ceil(view.pxToBp(view.width + 100).coord0)
  display.setRpcData(
    0,
    region([
      { transcript: 'vav-201', domain: 'SH2', start: onScreen },
      { transcript: 'vav-202', domain: 'RhoGEF', start: onScreen },
      { transcript: 'neighbour-201', domain: 'Torsin', start: offScreen },
      { transcript: 'neighbour-201', domain: 'DNase_II', start: offScreen },
    ]),
    ctgA,
  )
  return { display, view, onScreen, offScreen }
}

describe('rows and the key read the window, not the fetch buffer', () => {
  it('makes no row for a value only an off-screen feature carries', () => {
    const { display } = setup()
    expect(display.sources.map(s => s.name)).toEqual(['vav-201', 'vav-202'])
  })

  it('keys only the values a feature in view paints', () => {
    const { display } = setup()
    expect(display.colorLegend.map(e => e.label).sort()).toEqual([
      'RhoGEF',
      'SH2',
    ])
  })

  it('takes in the off-screen row and value once the window settles over them', () => {
    const { display, view, offScreen } = setup()
    view.navTo({ ...ctgA, start: offScreen - 100, end: offScreen + 500 })
    view.settleCoarseBlocks()
    expect(display.sources.map(s => s.name)).toEqual(['neighbour-201'])
    expect(display.colorLegend.map(e => e.label).sort()).toEqual([
      'DNase_II',
      'Torsin',
    ])
  })

  it('still hides a hidden value on a feature panning into a row before the window settles', () => {
    const { display, onScreen, offScreen } = setup()
    display.setRpcData(
      0,
      region([
        { transcript: 'vav-201', domain: 'SH2', start: onScreen },
        { transcript: 'vav-201', domain: 'Torsin', start: offScreen },
      ]),
      ctgA,
    )
    display.setHiddenCategories(['Torsin'])
    expect(display.colorLegend.map(e => e.label)).not.toContain('Torsin')
    expect(display.hiddenColors.size).toBe(1)
  })
})
