import { MAX_GROUPS, OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import {
  makeFeatureData as makeBaseFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { scaleLaidOutData } from './applyLayout.ts'
import { featureGroupSections } from './facet.ts'
import { computeLaidOutData } from './layout.ts'
import { maxBottom } from './layoutQueries.ts'
import { isPlacedRow } from './rowPlacement.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LayoutInputs, LayoutRegionData } from './layoutInputs.ts'

const HEIGHT = 20

// Every feature spans the same interval, so each section packs one row per
// feature and the row count is the feature count.
function regionData(
  features: { featureId: string; strand?: number; groupKey?: string }[],
  withLabels = false,
): LayoutRegionData {
  const floatingLabelsData: FeatureDataResult['floatingLabelsData'] = new Map()
  if (withLabels) {
    for (const f of features) {
      floatingLabelsData.set(f.featureId, {
        featureId: f.featureId,
        minX: 100,
        maxX: 500,
        topY: 0,
        featureHeight: HEIGHT,
        nameLabel: { text: f.featureId, relativeY: 0, textWidth: 40 },
      })
    }
  }
  return {
    regionKey: 'v:ctgA',
    ...makeBaseFeatureData({
      flatbushItems: features.map(f =>
        makeFlatbushItem({
          ...f,
          startBp: 100,
          endBp: 500,
          bottomPx: HEIGHT,
          featureHeightPx: HEIGHT,
        }),
      ),
      rectPositions: new Uint32Array(features.flatMap(() => [100, 500])),
      rectYs: new Float32Array(features.length),
      rectHeights: new Float32Array(features.map(() => HEIGHT)),
      rectColors: new Uint32Array(features.length),
      rectStrands: new Float32Array(features.map(f => f.strand ?? 0)),
      rectDensityFade: new Uint32Array(features.length),
      rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
      floatingLabelsData,
      featureCount: features.length,
    }),
  }
}

const base: LayoutInputs = {
  bpPerPx: 1,
  showLabels: true,
  showDescriptions: false,
  reversedRegions: new Set<number>(),
  displayMode: 'normal',
  pinnedFeatureIds: new Set<string>(),
  facet: { field: 'strand', domain: [] },
}

function topsOf(out: ReadonlyMap<number, FeatureDataResult>) {
  return new Map(
    [...out.values()].flatMap(d =>
      d.flatbushItems.map(i => [i.featureId, i.topPx] as const),
    ),
  )
}

const STRANDED = [
  { featureId: 'f1', strand: 1 },
  { featureId: 'f2', strand: 1 },
  { featureId: 'r1', strand: -1 },
  { featureId: 'r2', strand: -1 },
]

test('a hidden section leaves the pack and the stack closes over it', () => {
  const raw = new Map([[0, regionData(STRANDED)]])
  const shown = computeLaidOutData(raw, base)
  const out = computeLaidOutData(raw, {
    ...base,
    hiddenGroupKeys: new Set(['1']),
  })
  const tops = topsOf(out)
  expect(isPlacedRow(tops.get('f1')!)).toBe(false)
  expect(isPlacedRow(tops.get('f2')!)).toBe(false)
  expect(tops.get('r1')).toBe(GROUP_LABEL_HEIGHT)
  expect(maxBottom(out)).toBeLessThan(maxBottom(shown))
  expect(
    featureGroupSections(out, base.facet!, GROUP_LABEL_HEIGHT).map(s => s.key),
  ).toEqual(['-1'])
})

test('an attribute grouping sections by the stamped key, unvalued last', () => {
  const facet = { field: 'biotype', domain: [] }
  const raw = new Map([
    [
      0,
      regionData([
        { featureId: 'a', groupKey: 'lncRNA' },
        { featureId: 'b', groupKey: 'protein_coding' },
        { featureId: 'c', groupKey: '' },
      ]),
    ],
  ])
  const out = computeLaidOutData(raw, { ...base, facet })
  expect(
    featureGroupSections(out, facet, GROUP_LABEL_HEIGHT).map(s => s.label),
  ).toEqual(['biotype: lncRNA', 'biotype: protein_coding', 'biotype: none'])
})

test('a domain stacks the sections it lists first, the rest sorted behind', () => {
  const facet = { field: 'subtrack', domain: ['key5', 'key2', 'absent'] }
  const raw = new Map([
    [
      0,
      regionData([
        { featureId: 'a', groupKey: 'key1' },
        { featureId: 'b', groupKey: 'key2' },
        { featureId: 'c', groupKey: 'key3' },
        { featureId: 'd', groupKey: 'key5' },
        { featureId: 'e', groupKey: '' },
      ]),
    ],
  ])
  const out = computeLaidOutData(raw, { ...base, facet })
  expect(
    featureGroupSections(out, facet, GROUP_LABEL_HEIGHT).map(s => s.key),
  ).toEqual(['key5', 'key2', 'key1', 'key3', ''])
  const tops = topsOf(out)
  expect(tops.get('d')).toBeLessThan(tops.get('b')!)
  expect(tops.get('b')).toBeLessThan(tops.get('a')!)
})

test('past the cap the tail of values merges into one overflow section', () => {
  const facet = { field: 'id', domain: [] }
  const n = MAX_GROUPS + 5
  const raw = new Map([
    [
      0,
      regionData(
        Array.from({ length: n }, (_, i) => ({
          featureId: `f${i}`,
          groupKey: `v${String(i).padStart(3, '0')}`,
        })),
      ),
    ],
  ])
  const out = computeLaidOutData(raw, { ...base, facet })
  const sections = featureGroupSections(out, facet, GROUP_LABEL_HEIGHT)
  expect(sections).toHaveLength(MAX_GROUPS)
  expect(sections.at(-1)).toMatchObject({
    key: OVERFLOW_GROUP_KEY,
    label: '6 merged values',
  })
})

test('the fit scale squeezes the rows and leaves every chip row its height', () => {
  const raw = new Map([[0, regionData(STRANDED)]])
  const layout = computeLaidOutData(raw, base)
  const scale = 0.5
  const scaled = scaleLaidOutData(layout, scale, {
    facet: base.facet!,
    chipPx: GROUP_LABEL_HEIGHT,
  })
  const sections = featureGroupSections(scaled, base.facet!, GROUP_LABEL_HEIGHT)
  const tops = topsOf(scaled)
  // first row sits one full chip below the top
  expect(tops.get('f1')).toBe(GROUP_LABEL_HEIGHT)
  // the reverse section's rows start one chip below its top, at the scaled
  // forward rows' bottom
  expect(sections[1]!.top).toBe(
    GROUP_LABEL_HEIGHT +
      maxBottom(layout, new Set(['f1', 'f2'])) * scale -
      GROUP_LABEL_HEIGHT * scale,
  )
  expect(tops.get('r1')).toBe(sections[1]!.top + GROUP_LABEL_HEIGHT)
})
