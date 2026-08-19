import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// "Feature wins over subfeature on id collision" is a stated rule of
// `featureItemMap` with no coverage, and it is the reason the feature `set` is
// unconditional while the subfeature one is guarded. Anyone tidying that
// asymmetry into a matching `!map.has(id)` guard would silently invert it — a
// subfeature from an earlier region would then hold the id against a feature
// from a later one.
//
// The other half of that comment — that this map is last-wins across regions
// while `indexById` is first-wins — is NOT testable, and checking is what
// established it: `laidOutDataMap` is the laid-out map, and the packer gives a
// spanning feature one row across its whole ref-group, so both regions' copies
// carry identical geometry by the time either table is built. The comment says
// as much; this note is here so the next reader doesn't re-derive it.

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
  // both regions on screen at once — at the default zoom only the first is, and
  // every assertion here would pass vacuously against a one-region map
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
    // the collision arriving subfeature-first is the case a bare `!map.has`
    // guard would get wrong — it would leave the subfeature in place
    const display = setUp([
      [0, regionWith({ featureIds: [], subfeatureIds: ['shared'], topPx: 10 })],
      [1, regionWith({ featureIds: ['shared'], topPx: 20 })],
    ])

    expect(display.featureItemMap.get('shared')?.kind).toBe('feature')
  })
})
