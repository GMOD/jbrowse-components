import { getConf, setConf } from '@jbrowse/core/configuration'
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

  display.setFacet({ field: 'strand' })
  expect(display.facet).toEqual({ field: 'strand', domain: [] })
  expect(display.groupSections.map(s => [s.key, s.label, s.top])).toEqual([
    ['1', 'Forward strand', 0],
    ['-1', 'Reverse strand', expect.any(Number)],
  ])
  expect(display.groupSections[1]!.top).toBeGreaterThan(GROUP_LABEL_HEIGHT)
  expect(display.showsGroupLabels).toBe(true)

  display.setFacet(undefined)
  expect(display.groupSections).toEqual([])
})

test('a strand domain reorders the strands', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  display.setFacet({ field: 'strand', domain: ['-1'] })
  expect(display.groupSections.map(s => s.key)).toEqual(['-1', '1'])
})

test('an attribute grouping names its sections by value', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  display.setFacet({ field: 'biotype' })
  expect(display.groupSections.map(s => s.label)).toEqual([
    'biotype: lncRNA',
    'biotype: protein_coding',
  ])
  expect(display.rpcProps().displayConfig.facetField).toBe('biotype')
})

test('hiding a section is per key and drops with the grouping', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  display.setFacet({ field: 'strand' })

  display.hideGroup('1')
  expect(display.groupSections.map(s => s.key)).toEqual(['-1'])
  expect(display.truncatedFeatureCount).toBe(0)
  const show = display
    .trackMenuItems()
    .find(i => 'label' in i && i.label === 'Show...')!
  expect(
    resolveSubMenu(show as Parameters<typeof resolveSubMenu>[0]).map(i =>
      'label' in i ? i.label : undefined,
    ),
  ).toContain('Show 1 hidden group')

  display.setFacet({ field: 'biotype' })
  expect(display.hiddenGroups.size).toBe(0)
  expect(display.groupSections).toHaveLength(2)
})

test('a grouped track offsets its track label before any data lands', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  expect(display.prefersOffset).toBe(false)
  display.setFacet({ field: 'strand' })
  expect(display.groupSections).toEqual([])
  expect(display.prefersOffset).toBe(true)
})

test('grouping with its color writes the grouping color, and unticking takes it back', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.applyGroupBy('strand', true)
  expect(display.colorByMode).toBe('strand')

  display.applyGroupBy('biotype', true)
  expect(display.colorByAttribute).toBe('biotype')

  display.applyGroupBy('biotype', false)
  expect(display.colorByMode).toBe('default')

  display.setColorScale({ field: 'biotype', domain: ['b', 'a'] })
  display.applyGroupBy('biotype', false)
  expect(display.colorByMode).toBe('default')

  display.applyGroupBy('strand', true)
  display.applyGroupBy(undefined, false)
  expect(display.colorByMode).toBe('default')
})

test('a color picked by hand survives regrouping without the color', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setFeatureColor('purple')
  display.applyGroupBy('strand', false)
  display.applyGroupBy(undefined, false)
  expect(display.featureColor).toBe('purple')
})

test('reordering the sections keeps the hidden ones hidden', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  display.setFacet({ field: 'biotype' })
  display.hideGroup('lncRNA')
  display.setFacet({ field: 'biotype', domain: ['protein_coding'] })
  expect(display.hiddenGroups.size).toBe(1)
  expect(display.groupSections.map(s => s.key)).toEqual(['protein_coding'])
})

test('the Sections menu moves a section and writes the drawn order as the domain', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setRpcData(0, strandedRegionData(), ctgA)
  expect(
    display.trackMenuItems().find(i => 'label' in i && i.label === 'Sections'),
  ).toBeUndefined()
  display.setFacet({ field: 'biotype' })
  const rows = () => {
    const item = display
      .trackMenuItems()
      .find(i => 'label' in i && i.label === 'Sections')!
    return resolveSubMenu(item as Parameters<typeof resolveSubMenu>[0])
  }
  const labelOf = (i: MenuItem) => ('label' in i ? i.label : undefined)
  expect(rows().map(labelOf)).toEqual([
    'biotype: lncRNA',
    'biotype: protein_coding',
    'Reset section order',
  ])
  const first = rows()[0] as Parameters<typeof resolveSubMenu>[0]
  const moveDown = resolveSubMenu(first)[1] as { onClick: () => void }
  moveDown.onClick()
  expect(getConf(display, 'facetDomain')).toEqual(['protein_coding', 'lncRNA'])
  expect(display.groupSections.map(s => s.key)).toEqual([
    'protein_coding',
    'lncRNA',
  ])
  const reset = rows()[2] as { onClick: () => void }
  reset.onClick()
  expect(display.channelSpec.facet).toEqual({ field: 'biotype' })
})

test('re-picking the same field from the dialog keeps a curated domain', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  setConf(display, 'facetField', 'biotype')
  setConf(display, 'facetDomain', ['lncRNA'])
  display.applyGroupBy('biotype', true)
  expect(display.facet?.domain).toEqual(['lncRNA'])
  display.applyGroupBy('gene_type', true)
  expect(display.facet).toEqual({ field: 'gene_type', domain: [] })
})
