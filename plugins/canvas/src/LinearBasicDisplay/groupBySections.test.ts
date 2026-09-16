import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
} from '../RenderFeatureDataRPC/featureColors.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

function strandedRegionData() {
  const features = [
    { featureId: 'fwd', strand: 1, groupKey: 'protein_coding' },
    { featureId: 'rev', strand: -1, groupKey: 'lncRNA' },
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

test('grouping by strand stacks two labelled sections', () => {
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

  display.setGroupBy(undefined)
  expect(display.groupSections).toEqual([])
})

test('an attribute grouping names its sections by value', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  display.setGroupBy({ type: 'attribute', attribute: 'biotype' })
  expect(display.groupSections.map(s => s.label)).toEqual([
    'biotype: lncRNA',
    'biotype: protein_coding',
  ])
  expect(display.rpcProps().displayConfig.groupByAttribute).toBe('biotype')
})

test('hiding a section is per key and drops with the grouping', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  display.setGroupBy({ type: 'strand' })

  display.hideGroup('+')
  expect(display.groupSections.map(s => s.key)).toEqual(['-'])
  expect(display.truncatedFeatureCount).toBe(0)
  const show = display
    .trackMenuItems()
    .find(i => 'label' in i && i.label === 'Show...')!
  expect(
    resolveSubMenu(show as Parameters<typeof resolveSubMenu>[0]).map(i =>
      'label' in i ? i.label : undefined,
    ),
  ).toContain('Show 1 hidden group')

  display.setGroupBy({ type: 'attribute', attribute: 'biotype' })
  expect(display.hiddenGroups.size).toBe(0)
  expect(display.groupSections).toHaveLength(2)
})

test('a grouped track offsets its track label before any data lands', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  expect(display.prefersOffset).toBe(false)
  display.setGroupBy({ type: 'strand' })
  expect(display.groupSections).toEqual([])
  expect(display.prefersOffset).toBe(true)
})

test('grouping with its color writes the grouping color, and unticking takes it back', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.applyGroupBy({ type: 'strand' }, true)
  expect(display.conf.color).toBe(STRAND_COLOR_JEXL)

  display.applyGroupBy({ type: 'attribute', attribute: 'biotype' }, true)
  expect(display.conf.color).toBe(attributeColorJexl('biotype'))

  display.applyGroupBy({ type: 'attribute', attribute: 'biotype' }, false)
  expect(display.colorByMode).toBe('default')

  display.applyGroupBy({ type: 'strand' }, true)
  display.applyGroupBy(undefined, false)
  expect(display.colorByMode).toBe('default')
})

test('a color picked by hand survives regrouping without the color', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setFeatureColor('purple')
  display.applyGroupBy({ type: 'strand' }, false)
  display.applyGroupBy(undefined, false)
  expect(display.featureColor).toBe('purple')
})

test('reordering the sections keeps the hidden ones hidden', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  display.setGroupBy({ type: 'attribute', attribute: 'biotype' })
  display.hideGroup('lncRNA')
  display.setGroupBy({
    type: 'attribute',
    attribute: 'biotype',
    domain: ['protein_coding'],
  })
  expect(display.hiddenGroups.size).toBe(1)
  expect(display.groupSections.map(s => s.key)).toEqual(['protein_coding'])
})

test('a domain in the slot survives normalization, its entries as strings', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  setConf(display, 'groupBy', {
    type: 'attribute',
    attribute: 'bin',
    domain: [10, 2],
  })
  expect(display.groupBy).toEqual({
    type: 'attribute',
    attribute: 'bin',
    domain: ['10', '2'],
  })
})

test('an unrecognized grouping in the slot reads as ungrouped', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  setConf(display, 'groupBy', { type: 'flavour' })
  expect(display.groupBy).toBeUndefined()
})
