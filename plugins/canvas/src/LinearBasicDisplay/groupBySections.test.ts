import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

function strandedRegionData() {
  const features = [
    { featureId: 'fwd', strand: 1 },
    { featureId: 'rev', strand: -1 },
  ]
  return makeFeatureData({
    flatbushItems: features.map(f =>
      makeFlatbushItem({
        ...f,
        startBp: 100,
        endBp: 500,
        bottomPx: 20,
        featureHeightPx: 20,
      }),
    ),
    rectPositions: new Uint32Array(features.flatMap(() => [100, 500])),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.map(() => 20)),
    rectColors: new Uint32Array(features.length),
    rectStrands: new Float32Array(features.map(f => f.strand)),
    rectDensityFade: new Uint32Array(features.length),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
    featureCount: features.length,
  })
}

function groupByRadios(items: MenuItem[]) {
  const item = items.find(i => 'label' in i && i.label === 'Group by...')!
  return resolveSubMenu(item as Parameters<typeof resolveSubMenu>[0]).map(i => [
    'label' in i ? i.label : undefined,
    'checked' in i && i.checked,
  ])
}

test('grouping by strand stacks two labelled sections and the menu ticks it', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  expect(display.groupSections).toEqual([])
  expect(display.showsGroupLabels).toBe(false)

  display.setGroupBy({ type: 'strand' })
  expect(display.groupBy).toEqual({ type: 'strand' })
  expect(display.groupSections.map(s => [s.label, s.top])).toEqual([
    ['Forward strand', 0],
    ['Reverse strand', expect.any(Number)],
  ])
  expect(display.groupSections[1]!.top).toBeGreaterThan(GROUP_LABEL_HEIGHT)
  expect(display.showsGroupLabels).toBe(true)
  expect(groupByRadios(display.trackMenuItems())).toEqual([
    ['None', false],
    ['Strand', true],
  ])

  display.setGroupBy(undefined)
  expect(display.groupSections).toEqual([])
  expect(groupByRadios(display.trackMenuItems())).toEqual([
    ['None', true],
    ['Strand', false],
  ])
})

test('an unrecognized grouping in the slot reads as ungrouped', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay({ groupBy: { type: 'flavour' } })
  expect(display.groupBy).toBeUndefined()
})
