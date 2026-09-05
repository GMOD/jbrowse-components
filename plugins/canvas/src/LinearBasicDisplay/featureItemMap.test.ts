import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

function regionWith(opts: {
  featureIds: string[]
  subfeatureIds?: string[]
  topPx: number
}): FeatureDataResult {
  const { featureIds, subfeatureIds = [], topPx } = opts
  return makeFeatureData({
    flatbushItems: featureIds.map(featureId =>
      makeFlatbushItem({
        featureId,
        type: 'gene',
        topPx,
        bottomPx: topPx + 10,
      }),
    ),
    subfeatureInfos: subfeatureIds.map(featureId => ({
      kind: 'subfeature' as const,
      featureId,
      parentFeatureId: 'parent',
      type: 'mRNA',
      startBp: 0,
      endBp: 100,
      topPx,
      bottomPx: topPx + 10,
    })),
  })
}

function setUp(regions: [number, FeatureDataResult][]) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  // Both regions on screen at once: at the default zoom only the first is,
  // and every assertion here would pass vacuously against a one-region map.
  view.zoomTo(50)
  expect(
    new Set(
      view.visibleRegions.map(
        (r: { displayedRegionIndex: number }) => r.displayedRegionIndex,
      ),
    ).size,
  ).toBe(2)
  for (const [index, data] of regions) {
    display.setRpcData(index, data, {
      refName: 'ctgA',
      start: 0,
      end: 10_000,
      assemblyName: 'volvox',
    })
  }
  return display
}

describe('featureItemMap', () => {
  it('still lets a feature beat a subfeature that shares its id', () => {
    const display = setUp([
      [0, regionWith({ featureIds: [], subfeatureIds: ['shared'], topPx: 10 })],
      [1, regionWith({ featureIds: ['shared'], topPx: 20 })],
    ])

    expect(display.featureItemMap.get('shared')?.kind).toBe('feature')
  })
})
