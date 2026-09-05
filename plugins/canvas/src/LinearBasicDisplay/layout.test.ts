import { LABEL_FONT_SIZE } from '../RenderFeatureDataRPC/constants.ts'
import { ROW_PADDING } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  labelsMap,
  makeFeatureData as makeBaseFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { scaleLaidOutData } from './applyLayout.ts'
import {
  computeLaidOutData,
  createContentHeightProbe,
  createIncrementalLayout,
} from './layout.ts'
import { featureIdsTouchingBlocks, maxBottom } from './layoutQueries.ts'
import { packedContentHeight } from './layoutTestUtils.ts'

import type {
  FeatureDataResult,
  FloatingLabelsDataMap,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LayoutRegionData } from './layoutInputs.ts'

function makeFeatureData(opts: {
  features: {
    featureId: string
    startBp: number
    endBp: number
    height: number
    strand?: number
    densityFade?: boolean
  }[]
  regionKey?: string
}): LayoutRegionData {
  const { features } = opts
  return {
    regionKey: opts.regionKey ?? 'v:ctgA',
    ...makeBaseFeatureData({
      flatbushItems: features.map(f =>
        makeFlatbushItem({
          featureId: f.featureId,
          type: 'feature',
          startBp: f.startBp,
          endBp: f.endBp,
          bottomPx: f.height,
          featureHeightPx: f.height,
          strand: f.strand,
          densityFade: !!f.densityFade,
        }),
      ),
      rectPositions: new Uint32Array(
        features.flatMap(f => [f.startBp, f.endBp]),
      ),
      rectYs: new Float32Array(features.length),
      rectHeights: new Float32Array(features.map(f => f.height)),
      rectColors: new Uint32Array(features.length),
      rectStrands: new Float32Array(features.length),
      rectDensityFade: new Uint32Array(
        features.map(f => (f.densityFade ? 1 : 0)),
      ),
      rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
    }),
  }
}

function layout(
  raw: Map<number, LayoutRegionData>,
  bpPerPx: number,
  showLabels = true,
  showDescriptions = true,
  reversedRegions = new Set<number>(),
  displayMode: 'normal' | 'compact' | 'superCompact' | 'collapsed' = 'normal',
) {
  return computeLaidOutData(raw, {
    bpPerPx,
    showLabels,
    showDescriptions,
    reversedRegions,
    displayMode,
    pinnedFeatureIds: new Set<string>(),
  })
}

function labeledFeatureData(
  features: {
    featureId: string
    startBp: number
    endBp: number
    height: number
  }[],
  nameWidthPx = 40,
): LayoutRegionData {
  const base = makeFeatureData({ features })
  const floatingLabelsData: FeatureDataResult['floatingLabelsData'] = new Map()
  for (const f of features) {
    floatingLabelsData.set(f.featureId, {
      featureId: f.featureId,
      minX: f.startBp,
      maxX: f.endBp,
      topY: 0,
      featureHeight: f.height,
      nameLabel: {
        text: f.featureId,
        relativeY: 0,
        textWidth: nameWidthPx,
      },
    })
  }
  return { ...base, floatingLabelsData }
}

describe('fitWidth label decimation', () => {
  function decimate(
    data: LayoutRegionData,
    pinnedFeatureIds = new Set<string>(),
  ) {
    return computeLaidOutData(new Map([[0, data]]), {
      bpPerPx: 1,
      showLabels: true,
      showDescriptions: false,
      reversedRegions: new Set<number>(),
      displayMode: 'normal',
      pinnedFeatureIds,
      labelDecimation: 'fitWidth',
    }).get(0)!
  }

  const keptName = (labels: FloatingLabelsDataMap, featureId: string) =>
    labels.get(featureId)?.nameLabel !== undefined

  const mixed = () =>
    labeledFeatureData([
      { featureId: 'crowded', startBp: 100, endBp: 110, height: 20 },
      { featureId: 'blocker', startBp: 115, endBp: 125, height: 20 },
    ])

  it('drops a crowded narrow name but keeps one with overhang room', () => {
    const labels = decimate(mixed()).floatingLabelsData
    expect(keptName(labels, 'crowded')).toBe(false)
    expect(keptName(labels, 'blocker')).toBe(true)
  })

  it('keeps a narrow name that has open whitespace to overhang into', () => {
    const labels = decimate(
      labeledFeatureData([
        { featureId: 'lonely', startBp: 100, endBp: 110, height: 20 },
      ]),
    ).floatingLabelsData
    expect(keptName(labels, 'lonely')).toBe(true)
  })

  it('keeps a pinned name even when a neighbor crowds it', () => {
    const labels = decimate(mixed(), new Set(['crowded'])).floatingLabelsData
    expect(keptName(labels, 'crowded')).toBe(true)
  })

  it('keeps every name under the default `all` policy', () => {
    const out = layout(new Map([[0, mixed()]]), 1, true, false).get(0)!
    expect(out.floatingLabelsData.get('crowded')).toBeDefined()
    expect(out.floatingLabelsData.get('blocker')).toBeDefined()
  })

  it('packs a shorter stack than `all` by dropping decimated name rows', () => {
    const narrowStack = () =>
      labeledFeatureData(
        Array.from({ length: 6 }, (_, i) => ({
          featureId: `n${i}`,
          startBp: 100 + i * 5,
          endBp: 110 + i * 5,
          height: 20,
        })),
      )
    const allH = maxBottom(
      new Map([
        [0, layout(new Map([[0, narrowStack()]]), 1, true, false).get(0)!],
      ]),
    )
    const decimatedH = maxBottom(new Map([[0, decimate(narrowStack())]]))
    expect(decimatedH).toBeLessThan(allH)
  })

  it('keeps a name at exactly its reserved width of room, drops one below it', () => {
    const atThreshold = decimate(
      labeledFeatureData([
        { featureId: 'probe', startBp: 100, endBp: 110, height: 20 },
        { featureId: 'next', startBp: 146, endBp: 156, height: 20 }, // room 46
      ]),
    ).floatingLabelsData
    expect(keptName(atThreshold, 'probe')).toBe(true)

    const belowThreshold = decimate(
      labeledFeatureData([
        { featureId: 'probe', startBp: 100, endBp: 110, height: 20 },
        { featureId: 'next', startBp: 145, endBp: 155, height: 20 }, // room 45
      ]),
    ).floatingLabelsData
    expect(keptName(belowThreshold, 'probe')).toBe(false)
  })

  it('decimation is monotone in overhang room', () => {
    const keptAt = (gap: number) =>
      keptName(
        decimate(
          labeledFeatureData([
            { featureId: 'probe', startBp: 100, endBp: 110, height: 20 },
            {
              featureId: 'next',
              startBp: 100 + gap,
              endBp: 110 + gap,
              height: 20,
            },
          ]),
        ).floatingLabelsData,
        'probe',
      )
    const kept = [10, 30, 45, 46, 60, 100].map(keptAt)
    expect(kept).toStrictEqual([...kept].sort((a, b) => Number(a) - Number(b)))
    expect(kept.at(-1)).toBe(true)
    expect(kept[0]).toBe(false)
  })

  it('keeps fewer names as labelRoomFactor rises', () => {
    const decimateAt = (factor: number, gap: number) =>
      keptName(
        computeLaidOutData(
          new Map([
            [
              0,
              labeledFeatureData([
                { featureId: 'probe', startBp: 100, endBp: 110, height: 20 },
                {
                  featureId: 'next',
                  startBp: 100 + gap,
                  endBp: 110 + gap,
                  height: 20,
                },
              ]),
            ],
          ]),
          {
            bpPerPx: 1,
            showLabels: true,
            showDescriptions: false,
            reversedRegions: new Set<number>(),
            displayMode: 'normal',
            pinnedFeatureIds: new Set<string>(),
            labelDecimation: 'fitWidth',
            labelRoomFactor: factor,
          },
        ).get(0)!.floatingLabelsData,
        'probe',
      )
    expect(decimateAt(1, 46)).toBe(true)
    expect(decimateAt(2, 46)).toBe(false)
    expect(decimateAt(2, 100)).toBe(true)
    expect(decimateAt(4, 100)).toBe(false)
    expect(decimateAt(1, 30)).toBe(false)
    expect(decimateAt(0.5, 30)).toBe(true)
    expect(decimateAt(0.25, 30)).toBe(true)
  })

  it('keeps a pinned name at any labelRoomFactor', () => {
    const labels = computeLaidOutData(new Map([[0, mixed()]]), {
      bpPerPx: 1,
      showLabels: true,
      showDescriptions: false,
      reversedRegions: new Set<number>(),
      displayMode: 'normal',
      pinnedFeatureIds: new Set(['crowded']),
      labelDecimation: 'fitWidth',
      labelRoomFactor: 4,
    }).get(0)!.floatingLabelsData
    expect(keptName(labels, 'crowded')).toBe(true)
  })

  it('measures overhang room leftward in a reversed region', () => {
    const out = computeLaidOutData(
      new Map([
        [
          0,
          labeledFeatureData([
            { featureId: 'edge', startBp: 100, endBp: 110, height: 20 },
            { featureId: 'blockerL', startBp: 60, endBp: 105, height: 20 }, // ends 5 left of edge
          ]),
        ],
      ]),
      {
        bpPerPx: 1,
        showLabels: true,
        showDescriptions: false,
        reversedRegions: new Set([0]),
        displayMode: 'normal',
        pinnedFeatureIds: new Set<string>(),
        labelDecimation: 'fitWidth',
      },
    ).get(0)!.floatingLabelsData
    expect(keptName(out, 'edge')).toBe(false) // crowded 5px on its left
    expect(keptName(out, 'blockerL')).toBe(true) // leftmost end, open to the left
  })

  it('a pile sharing one start sheds its names under decimation, a lone feature keeps its own', () => {
    const pile = Array.from({ length: 20 }, (_, i) => ({
      featureId: `pile${i}`,
      startBp: 1000,
      endBp: 1001,
      height: 20,
    }))
    const data = new Map([
      [
        0,
        labeledFeatureData([
          ...pile,
          { featureId: 'lone', startBp: 5000, endBp: 5001, height: 20 },
        ]),
      ],
    ])
    const inputs = {
      bpPerPx: 1,
      showLabels: true,
      showDescriptions: false,
      reversedRegions: new Set<number>(),
      displayMode: 'normal' as const,
      pinnedFeatureIds: new Set<string>(),
      labelDecimation: 'fitWidth' as const,
    }
    const heightAt = createContentHeightProbe(data, inputs)
    expect(heightAt(8)).toBeLessThan(heightAt(0))

    const labels = computeLaidOutData(data, {
      ...inputs,
      labelRoomFactor: 8,
    }).get(0)!.floatingLabelsData
    expect(keptName(labels, 'pile0')).toBe(false)
    expect(keptName(labels, 'pile19')).toBe(false)
    expect(keptName(labels, 'lone')).toBe(true)
  })

  it('a pile sharing one end sheds its names in a reversed region', () => {
    const labels = computeLaidOutData(
      new Map([
        [
          0,
          labeledFeatureData([
            { featureId: 'a', startBp: 900, endBp: 1000, height: 20 },
            { featureId: 'b', startBp: 950, endBp: 1000, height: 20 },
            { featureId: 'lone', startBp: 100, endBp: 110, height: 20 },
          ]),
        ],
      ]),
      {
        bpPerPx: 1,
        showLabels: true,
        showDescriptions: false,
        reversedRegions: new Set([0]),
        displayMode: 'normal',
        pinnedFeatureIds: new Set<string>(),
        labelDecimation: 'fitWidth',
      },
    ).get(0)!.floatingLabelsData
    expect(keptName(labels, 'a')).toBe(false)
    expect(keptName(labels, 'b')).toBe(false)
    expect(keptName(labels, 'lone')).toBe(true)
  })
})

test('layout is pure: raw data is not mutated', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const raw = new Map([[0, data]])

  const out = layout(raw, 1)

  expect(out).not.toBe(raw)
  expect(out.get(0)).not.toBe(data)
  expect(data.flatbushItems[0]!.topPx).toBe(0)
  expect(data.flatbushItems[1]!.topPx).toBe(0)
  expect(data.rectYs[0]).toBe(0)
  expect(data.rectYs[1]).toBe(0)
})

test('overlapping features on same chromosome get different rows', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const out = layout(new Map([[0, data]]), 1)

  const r = out.get(0)!
  expect(r.flatbushItems[0]!.topPx).toBe(0)
  expect(r.flatbushItems[1]!.topPx).toBeGreaterThan(0)
})

test('collapsed mode stacks overlapping features onto a single row', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const out = layout(
    new Map([[0, data]]),
    1,
    false,
    false,
    new Set<number>(),
    'collapsed',
  )

  const r = out.get(0)!
  expect(r.flatbushItems[0]!.topPx).toBe(0)
  expect(r.flatbushItems[1]!.topPx).toBe(0)
})

const collapsedModeLayout = (data: LayoutRegionData, bpPerPx: number) =>
  layout(
    new Map([[0, data]]),
    bpPerPx,
    false,
    false,
    new Set<number>(),
    'collapsed',
  ).get(0)!

test('collapsed mode fades sub-pixel marks piled on one pixel', () => {
  const data = makeFeatureData({
    features: Array.from({ length: 5 }, (_, i) => ({
      featureId: `snp${i}`,
      startBp: 100 + i,
      endBp: 101 + i,
      height: 10,
      densityFade: true,
    })),
  })
  const r = collapsedModeLayout(data, 26)
  expect(r.flatbushItems.every(it => it.topPx === 0)).toBe(true)
  expect([...r.rectDensityFade].every(v => v === 1)).toBe(true)
})

test('collapsed mode leaves marks with room around them opaque', () => {
  const data = makeFeatureData({
    features: Array.from({ length: 5 }, (_, i) => ({
      featureId: `snp${i}`,
      startBp: 100 + i * 100,
      endBp: 101 + i * 100,
      height: 10,
      densityFade: true,
    })),
  })
  expect(
    [...collapsedModeLayout(data, 1).rectDensityFade].every(v => v === 0),
  ).toBe(true)
})

test('collapsed mode leaves abutting repeat-style elements opaque', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'rep0', startBp: 1000, endBp: 1200, height: 10 },
      { featureId: 'rep1', startBp: 1200, endBp: 1400, height: 10 },
      { featureId: 'rep2', startBp: 1600, endBp: 1800, height: 10 },
    ].map(f => ({ ...f, densityFade: true })),
  })
  const r = collapsedModeLayout(data, 150)
  expect(r.flatbushItems.every(it => it.topPx === 0)).toBe(true)
  expect([...r.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('collapsed mode fades the same elements once a third lands on them', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'rep0', startBp: 1000, endBp: 1200, height: 10 },
      { featureId: 'rep1', startBp: 1100, endBp: 1300, height: 10 },
      { featureId: 'rep2', startBp: 1200, endBp: 1400, height: 10 },
    ].map(f => ({ ...f, densityFade: true })),
  })
  const r = collapsedModeLayout(data, 150)
  expect([...r.rectDensityFade].every(v => v === 1)).toBe(true)
})

test('collapsed mode leaves three overlapping wide boxes opaque', () => {
  const data = makeFeatureData({
    features: [0, 1, 2].map(i => ({
      featureId: `wide${i}`,
      startBp: 100 + i * 10,
      endBp: 400 + i * 10,
      height: 10,
      densityFade: true,
    })),
  })
  const r = collapsedModeLayout(data, 1)
  expect(r.flatbushItems.every(it => it.topPx === 0)).toBe(true)
  expect([...r.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('collapsed mode does not fade a wide feature it overlaps another with', () => {
  const data = makeFeatureData({
    features: [
      {
        featureId: 'geneA',
        startBp: 100,
        endBp: 500,
        height: 20,
        densityFade: true,
      },
      {
        featureId: 'geneB',
        startBp: 200,
        endBp: 600,
        height: 20,
        densityFade: true,
      },
    ],
  })
  const r = collapsedModeLayout(data, 1)
  expect(r.flatbushItems.every(it => it.topPx === 0)).toBe(true)
  expect([...r.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('different chromosomes get independent layouts', () => {
  const a = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const b = makeFeatureData({
    features: [
      { featureId: 'f3', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f4', startBp: 200, endBp: 600, height: 20 },
    ],
    regionKey: 'v:ctgB',
  })
  const out = layout(
    new Map([
      [0, a],
      [1, b],
    ]),
    1,
  )

  expect(out.get(0)!.flatbushItems[0]!.topPx).toBe(0)
  expect(out.get(1)!.flatbushItems[0]!.topPx).toBe(0)
})

test('same-chromosome discontiguous regions share spanning feature Y', () => {
  const r1 = makeFeatureData({
    features: [
      { featureId: 'spanning', startBp: 50, endBp: 250, height: 20 },
      { featureId: 'local1', startBp: 10, endBp: 90, height: 20 },
    ],
  })
  const r2 = makeFeatureData({
    features: [
      { featureId: 'spanning', startBp: 50, endBp: 250, height: 20 },
      { featureId: 'local2', startBp: 210, endBp: 290, height: 20 },
    ],
  })
  const out = layout(
    new Map([
      [0, r1],
      [1, r2],
    ]),
    1,
  )

  const s1 = out.get(0)!.flatbushItems.find(f => f.featureId === 'spanning')!
  const s2 = out.get(1)!.flatbushItems.find(f => f.featureId === 'spanning')!
  expect(s1.topPx).toBe(s2.topPx)
})

test('non-overlapping features on same chromosome share the first row', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20 },
      { featureId: 'f2', startBp: 300, endBp: 400, height: 20 },
    ],
  })
  const out = layout(new Map([[0, data]]), 1)
  const r = out.get(0)!
  expect(r.flatbushItems[0]!.topPx).toBe(0)
  expect(r.flatbushItems[1]!.topPx).toBe(0)
})

test('a wide feature offscreen leaves the visible row free', () => {
  const data = makeFeatureData({
    features: [
      {
        featureId: 'offscreen',
        startBp: 153_748_132,
        endBp: 154_894_285,
        height: 150,
      },
      {
        featureId: 'onscreen',
        startBp: 155_288_595,
        endBp: 155_298_980,
        height: 30,
      },
    ],
  })
  const out = layout(new Map([[0, data]]), 13.6)
  const top = (id: string) =>
    out.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx

  expect(top('offscreen')).toBe(0)
  expect(top('onscreen')).toBe(0)
})

test('same inputs produce identical output (deterministic)', () => {
  const mk = () =>
    makeFeatureData({
      features: [
        { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
        { featureId: 'f2', startBp: 200, endBp: 600, height: 25 },
      ],
    })
  const a = layout(new Map([[0, mk()]]), 1)
  const b = layout(new Map([[0, mk()]]), 1)

  for (let i = 0; i < 2; i++) {
    expect(a.get(0)!.flatbushItems[i]!.topPx).toBe(
      b.get(0)!.flatbushItems[i]!.topPx,
    )
  }
})

test('rectYs are offset by the layout top for each feature', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const out = layout(new Map([[0, data]]), 1)
  const r = out.get(0)!
  for (let i = 0; i < r.rectYs.length; i++) {
    expect(r.rectYs[i]).toBe(r.flatbushItems[r.rectFeatureIndices[i]!]!.topPx)
  }
})

test('bpPerPx changes label-driven packing', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20 },
      { featureId: 'f2', startBp: 300, endBp: 400, height: 20 },
    ],
  })
  data.floatingLabelsData = labelsMap({
    f1: {
      featureId: 'f1',
      minX: 100,
      maxX: 200,
      topY: 0,
      featureHeight: 20,
      nameLabel: { text: 'L1', relativeY: 0, textWidth: 300 },
    },
    f2: {
      featureId: 'f2',
      minX: 300,
      maxX: 400,
      topY: 0,
      featureHeight: 20,
      nameLabel: { text: 'L2', relativeY: 0, textWidth: 300 },
    },
  })
  const zoomedOut = layout(new Map([[0, data]]), 1)
  const zo = zoomedOut.get(0)!
  expect(zo.flatbushItems[0]!.topPx).not.toBe(zo.flatbushItems[1]!.topPx)

  const zoomedIn = layout(new Map([[0, data]]), 0.1)
  const zi = zoomedIn.get(0)!
  expect(zi.flatbushItems[0]!.topPx).toBe(0)
  expect(zi.flatbushItems[1]!.topPx).toBe(0)
})

test('subfeatures and floating labels inherit their parent feature offset', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'gene1', startBp: 100, endBp: 500, height: 30 },
      { featureId: 'gene2', startBp: 200, endBp: 600, height: 30 },
    ],
  })
  data.subfeatureInfos = [
    {
      kind: 'subfeature',
      featureId: 'exon2',
      parentFeatureId: 'gene2',
      type: 'exon',
      startBp: 300,
      endBp: 350,
      topPx: 5,
      bottomPx: 15,
    },
  ]
  data.floatingLabelsData = labelsMap({
    gene2: {
      featureId: 'gene2',
      minX: 200,
      maxX: 600,
      topY: 0,
      featureHeight: 30,
      nameLabel: {
        text: 'Gene 2',
        relativeY: 0,
        textWidth: 50,
      },
    },
  })

  const out = layout(new Map([[0, data]]), 1)
  const r = out.get(0)!
  const gene2Top = r.flatbushItems[1]!.topPx
  expect(gene2Top).toBeGreaterThan(0)
  expect(r.subfeatureInfos[0]!.topPx).toBe(5 + gene2Top)
  expect(r.subfeatureInfos[0]!.bottomPx).toBe(15 + gene2Top)
  expect(r.floatingLabelsData.get('gene2')!.topY).toBe(gene2Top)
})

test('lines and arrows are offset by parent feature top', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  data.linePositions = new Uint32Array([200, 400])
  data.lineYs = new Float32Array([10])
  data.lineHeights = new Float32Array([20])
  data.lineColors = new Uint32Array([0xff000000])
  data.lineDirections = new Int8Array([1])
  data.lineFeatureIndices = new Uint32Array([1])
  data.arrowXs = new Uint32Array([600])
  data.arrowYs = new Float32Array([10])
  data.arrowHeights = new Float32Array([20])
  data.arrowDirections = new Int8Array([1])
  data.arrowColors = new Uint32Array([0xff000000])
  data.arrowFeatureIndices = new Uint32Array([1])

  const out = layout(new Map([[0, data]]), 1)
  const r = out.get(0)!
  const f2Top = r.flatbushItems[1]!.topPx
  expect(f2Top).toBeGreaterThan(0)
  expect(r.lineYs[0]).toBe(10 + f2Top)
  expect(r.arrowYs[0]).toBe(10 + f2Top)
})

test('showLabels adds label height to the feature row', () => {
  const mk = () => {
    const data = makeFeatureData({
      features: [
        { featureId: 'f1', startBp: 100, endBp: 500, height: 10 },
        { featureId: 'f2', startBp: 200, endBp: 600, height: 10 },
      ],
    })
    data.floatingLabelsData = labelsMap({
      f1: {
        featureId: 'f1',
        minX: 100,
        maxX: 500,
        topY: 0,
        featureHeight: 10,
        nameLabel: {
          text: 'Gene 1',
          relativeY: 0,
          textWidth: 50,
        },
        descriptionLabel: {
          text: 'A description',
          relativeY: 12,
          textWidth: 80,
        },
      },
    })
    return data
  }

  const featureHeight = 10
  const withLabels = layout(new Map([[0, mk()]]), 1, true, true)
  expect(withLabels.get(0)!.flatbushItems[0]!.bottomPx).toBe(
    featureHeight + ROW_PADDING.normal + LABEL_FONT_SIZE * 2,
  )

  const withoutLabels = layout(new Map([[0, mk()]]), 1, false, false)
  expect(withoutLabels.get(0)!.flatbushItems[0]!.bottomPx).toBe(
    featureHeight + ROW_PADDING.normal,
  )

  const descOnly = layout(new Map([[0, mk()]]), 1, false, true)
  expect(descOnly.get(0)!.flatbushItems[0]!.bottomPx).toBe(
    featureHeight + ROW_PADDING.normal + LABEL_FONT_SIZE,
  )
})

test("forward feature's right arrow overhang pushes a feature in its gap to another row", () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20, strand: 1 },
      { featureId: 'f2', startBp: 204, endBp: 300, height: 20, strand: 1 },
    ],
  })
  const out = layout(new Map([[0, data]]), 1)
  expect(out.get(0)!.flatbushItems[1]!.topPx).toBeGreaterThan(0)
})

test('arrow padding is directional: forward features just past the arrow share a row', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20, strand: 1 },
      { featureId: 'f2', startBp: 220, endBp: 300, height: 20, strand: 1 },
    ],
  })
  const out = layout(new Map([[0, data]]), 1)
  expect(out.get(0)!.flatbushItems[0]!.topPx).toBe(0)
  expect(out.get(0)!.flatbushItems[1]!.topPx).toBe(0)
})

test('a feature too narrow to draw its arrow reserves no room for one', () => {
  const tops = (widthBp: number) =>
    layout(
      new Map([
        [
          0,
          makeFeatureData({
            features: [
              {
                featureId: 'f1',
                startBp: 100,
                endBp: 100 + widthBp,
                height: 20,
                strand: 1,
              },
              {
                featureId: 'f2',
                startBp: 103 + widthBp,
                endBp: 103 + 2 * widthBp,
                height: 20,
                strand: 1,
              },
            ],
          }),
        ],
      ]),
      1,
    )
      .get(0)!
      .flatbushItems.map(f => f.topPx)

  expect(tops(20)[1]).toBeGreaterThan(0)
  expect(tops(10)).toEqual([0, 0])
})

test('unstranded features without arrow padding can share a row when close', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20 },
      { featureId: 'f2', startBp: 220, endBp: 300, height: 20 },
    ],
  })
  const out = layout(new Map([[0, data]]), 1)
  const r = out.get(0)!
  expect(r.flatbushItems[0]!.topPx).toBe(0)
  expect(r.flatbushItems[1]!.topPx).toBe(0)
})

test('reversed region reserves label overhang on the lower-bp side', () => {
  const mk = () => {
    const data = makeFeatureData({
      features: [
        { featureId: 'fLeft', startBp: 50, endBp: 100, height: 10 },
        { featureId: 'fLabel', startBp: 200, endBp: 250, height: 10 },
      ],
    })
    data.floatingLabelsData = labelsMap({
      fLabel: {
        featureId: 'fLabel',
        minX: 200,
        maxX: 250,
        topY: 0,
        featureHeight: 10,
        nameLabel: { text: 'L', relativeY: 0, textWidth: 300 },
      },
    })
    return data
  }

  const fwd = layout(new Map([[0, mk()]]), 1, true, true)
  expect(fwd.get(0)!.flatbushItems[0]!.topPx).toBe(0)
  expect(fwd.get(0)!.flatbushItems[1]!.topPx).toBe(0)

  const rev = layout(new Map([[0, mk()]]), 1, true, true, new Set([0]))
  const rLeft = rev.get(0)!.flatbushItems[0]!
  const rLabel = rev.get(0)!.flatbushItems[1]!
  expect(rLeft.topPx).not.toBe(rLabel.topPx)
})

describe('subfeature-label overhang is reserved even with no name line', () => {
  function data() {
    const base = makeFeatureData({
      features: [
        { featureId: 'geneA', startBp: 0, endBp: 10, height: 10 },
        { featureId: 'geneB', startBp: 20, endBp: 30, height: 10 },
      ],
    })
    const floatingLabelsData: FloatingLabelsDataMap = labelsMap({
      'geneA-mRNA1': {
        featureId: 'geneA-mRNA1',
        minX: 0,
        maxX: 10,
        topY: 0,
        featureHeight: 10,
        parentFeatureId: 'geneA',
        subfeatureLabel: {
          text: 'geneA-mRNA1',
          relativeY: 0,
          textWidth: 100,
          isOverlay: false,
        },
      },
    })
    return { ...base, floatingLabelsData }
  }

  it.each([
    ['names on', true],
    ['names off (fit bodies rung)', false],
  ])('%s', (_name, showLabels) => {
    const out = layout(new Map([[0, data()]]), 1, showLabels, false)
    const [a, b] = out.get(0)!.flatbushItems
    expect(a!.topPx).toBe(0)
    expect(b!.topPx).toBeGreaterThan(0)
  })
})

// A stable empty set: the incremental memo compares the pinned set by
// reference, so a fresh set per call would bust the cache.
const NO_PINNED: ReadonlySet<string> = new Set<string>()

function incInputs(
  bpPerPx = 1,
  reversedRegions = new Set<number>(),
  pinnedFeatureIds: ReadonlySet<string> = NO_PINNED,
) {
  return {
    bpPerPx,
    showLabels: true,
    showDescriptions: true,
    reversedRegions,
    displayMode: 'normal' as const,
    pinnedFeatureIds,
  }
}

test('incremental memo matches the pure layout values', () => {
  const a = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const b = makeFeatureData({
    features: [{ featureId: 'f3', startBp: 100, endBp: 500, height: 20 }],
    regionKey: 'v:ctgB',
  })
  const raw = new Map([
    [0, a],
    [1, b],
  ])
  const pure = computeLaidOutData(raw, incInputs())
  const inc = createIncrementalLayout()(raw, incInputs())

  for (const idx of [0, 1]) {
    expect(inc.get(idx)!.flatbushItems.map(f => f.topPx)).toEqual(
      pure.get(idx)!.flatbushItems.map(f => f.topPx),
    )
  }
})

test('incremental memo: a new chromosome leaves existing groups reference-stable', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const first = memo(new Map([[0, a]]), incInputs())
  const aOut = first.get(0)

  const b = makeFeatureData({
    features: [{ featureId: 'f3', startBp: 100, endBp: 500, height: 20 }],
    regionKey: 'v:ctgB',
  })
  const second = memo(
    new Map([
      [0, a],
      [1, b],
    ]),
    incInputs(),
  )

  expect(second.get(0)).toBe(aOut)
  expect(second.get(1)).toBeDefined()
})

test('incremental memo: changing a region recomputes its group', () => {
  const memo = createIncrementalLayout()
  const mk = () =>
    makeFeatureData({
      features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
    })
  const first = memo(new Map([[0, mk()]]), incInputs())
  const second = memo(new Map([[0, mk()]]), incInputs())
  expect(second.get(0)).not.toBe(first.get(0))
})

test('incremental memo: bpPerPx change recomputes every group', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const first = memo(new Map([[0, a]]), incInputs(1))
  const second = memo(new Map([[0, a]]), incInputs(2))
  expect(second.get(0)).not.toBe(first.get(0))
})

test('incremental memo: a region added to an existing ref-group recomputes that group', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const first = memo(new Map([[0, a]]), incInputs())

  const b = makeFeatureData({
    features: [{ featureId: 'f2', startBp: 600, endBp: 900, height: 20 }],
  })
  const second = memo(
    new Map([
      [0, a],
      [1, b],
    ]),
    incInputs(),
  )
  expect(second.get(0)).not.toBe(first.get(0))
})

test('incremental memo: flipping a region reversed recomputes its group', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const first = memo(new Map([[0, a]]), incInputs(1, new Set()))
  const second = memo(new Map([[0, a]]), incInputs(1, new Set([0])))
  expect(second.get(0)).not.toBe(first.get(0))
})

test('incremental memo: toggling dropBelowLabelRows recomputes its group', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const first = memo(new Map([[0, a]]), incInputs())
  const second = memo(new Map([[0, a]]), {
    ...incInputs(),
    dropBelowLabelRows: true,
  })
  expect(second.get(0)).not.toBe(first.get(0))
})

test('incremental memo: a new expandedGeneIds set recomputes its group, the same set reuses it', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const expandedGeneIds: ReadonlySet<string> = new Set(['f1'])
  const first = memo(new Map([[0, a]]), { ...incInputs(), expandedGeneIds })
  const same = memo(new Map([[0, a]]), { ...incInputs(), expandedGeneIds })
  expect(same.get(0)).toBe(first.get(0))
  const fresh = memo(new Map([[0, a]]), {
    ...incInputs(),
    expandedGeneIds: new Set(['f1']),
  })
  expect(fresh.get(0)).not.toBe(first.get(0))
})

test('incremental memo: changing maxIsoformsPerGene recomputes its group, the same count reuses it', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const first = memo(new Map([[0, a]]), {
    ...incInputs(),
    maxIsoformsPerGene: 3,
  })
  const same = memo(new Map([[0, a]]), {
    ...incInputs(),
    maxIsoformsPerGene: 3,
  })
  expect(same.get(0)).toBe(first.get(0))
  const fewer = memo(new Map([[0, a]]), {
    ...incInputs(),
    maxIsoformsPerGene: 2,
  })
  expect(fewer.get(0)).not.toBe(first.get(0))
})

test('incremental memo: changing collapseDepth recomputes its group, the same depth reuses it', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const first = memo(new Map([[0, a]]), { ...incInputs(), collapseDepth: 25 })
  const same = memo(new Map([[0, a]]), { ...incInputs(), collapseDepth: 25 })
  expect(same.get(0)).toBe(first.get(0))
  const shallower = memo(new Map([[0, a]]), {
    ...incInputs(),
    collapseDepth: 5,
  })
  expect(shallower.get(0)).not.toBe(first.get(0))
})

test('incremental: adding a new region does not move features in existing regions', () => {
  const a = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const first = layout(new Map([[0, a]]), 1)
  const aFirst = first.get(0)!
  const f1Top = aFirst.flatbushItems[0]!.topPx
  const f2Top = aFirst.flatbushItems[1]!.topPx

  const b = makeFeatureData({
    features: [{ featureId: 'f3', startBp: 100, endBp: 500, height: 20 }],
    regionKey: 'v:ctgB',
  })
  const second = layout(
    new Map([
      [0, a],
      [1, b],
    ]),
    1,
  )

  expect(second.get(0)!.flatbushItems[0]!.topPx).toBe(f1Top)
  expect(second.get(0)!.flatbushItems[1]!.topPx).toBe(f2Top)
  expect(second.get(1)!.flatbushItems[0]!.topPx).toBe(0)
})

test('a feature compacts up to a freed row on zoom-in (no downward hold)', () => {
  const withNameLabel = (data: LayoutRegionData, id: string, width: number) => {
    data.floatingLabelsData.set(id, {
      featureId: id,
      minX: 0,
      maxX: 0,
      topY: 0,
      featureHeight: 10,
      nameLabel: { text: id, relativeY: 0, textWidth: width },
    })
    return data
  }
  const mk = () =>
    withNameLabel(
      withNameLabel(
        makeFeatureData({
          features: [
            { featureId: 'A', startBp: 1000, endBp: 1100, height: 10 },
            { featureId: 'B', startBp: 1500, endBp: 1600, height: 10 },
          ],
        }),
        'A',
        300,
      ),
      'B',
      1,
    )
  const bTop = (r: Map<number, FeatureDataResult>) =>
    r.get(0)!.flatbushItems.find(it => it.featureId === 'B')!.topPx
  const memo = createIncrementalLayout()

  expect(bTop(memo(new Map([[0, mk()]]), incInputs(2)))).toBeGreaterThan(0)
  expect(bTop(memo(new Map([[0, mk()]]), incInputs(1)))).toBe(0)
})

test('re-pack orders by prior y so a top feature keeps its low row', () => {
  const mk = () =>
    makeFeatureData({
      features: [
        { featureId: 'A', startBp: 1000, endBp: 2000, height: 20 },
        { featureId: 'B', startBp: 1500, endBp: 2500, height: 20 },
      ],
    })
  const topOf = (r: Map<number, FeatureDataResult>, id: string) =>
    r.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx

  const fresh = computeLaidOutData(new Map([[0, mk()]]), incInputs(1))
  expect(topOf(fresh, 'A')).toBe(0)
  expect(topOf(fresh, 'B')).toBeGreaterThan(0)

  const primed = computeLaidOutData(
    new Map([[0, mk()]]),
    incInputs(1),
    new Map([
      ['B', 0],
      ['A', 100],
    ]),
  )
  expect(topOf(primed, 'B')).toBe(0)
  expect(topOf(primed, 'A')).toBeGreaterThan(0)
})

test('a pinned feature claims the top row over its overlappers', () => {
  const mk = () =>
    makeFeatureData({
      features: [
        { featureId: 'A', startBp: 1000, endBp: 2000, height: 20 },
        { featureId: 'B', startBp: 1500, endBp: 2500, height: 20 },
      ],
    })
  const topOf = (r: Map<number, FeatureDataResult>, id: string) =>
    r.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx

  const unpinned = computeLaidOutData(new Map([[0, mk()]]), incInputs(1))
  expect(topOf(unpinned, 'A')).toBe(0)
  expect(topOf(unpinned, 'B')).toBeGreaterThan(0)

  const pinnedB = computeLaidOutData(
    new Map([[0, mk()]]),
    incInputs(1, new Set<number>(), new Set(['B'])),
  )
  expect(topOf(pinnedB, 'B')).toBe(0)
  expect(topOf(pinnedB, 'A')).toBeGreaterThan(0)
})

test('incremental memo busts when the pinned set reference changes', () => {
  const mk = () =>
    makeFeatureData({
      features: [
        { featureId: 'A', startBp: 1000, endBp: 2000, height: 20 },
        { featureId: 'B', startBp: 1500, endBp: 2500, height: 20 },
      ],
    })
  const topOf = (r: Map<number, FeatureDataResult>, id: string) =>
    r.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx
  const memo = createIncrementalLayout()

  const before = memo(new Map([[0, mk()]]), incInputs(1))
  const beforeOut = before.get(0)
  expect(topOf(before, 'A')).toBe(0)

  const after = memo(
    new Map([[0, mk()]]),
    incInputs(1, new Set<number>(), new Set(['B'])),
  )
  expect(after.get(0)).not.toBe(beforeOut)
  expect(topOf(after, 'B')).toBe(0)
})

test('a collapsed pile does not outrank an arriving gene for the top row', () => {
  const marks = Array.from({ length: 25 }, (_, i) => ({
    featureId: `snp${i}`,
    startBp: 5000 + i,
    endBp: 5001 + i,
    height: 10,
    densityFade: true,
  }))
  const gene = {
    featureId: 'gene',
    startBp: 4000,
    endBp: 6000,
    height: 10,
    densityFade: false,
  }
  const memo = createIncrementalLayout()
  const topOf = (r: Map<number, FeatureDataResult>, id: string) =>
    r.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx

  const before = memo(
    new Map([[0, makeFeatureData({ features: marks })]]),
    incInputs(20),
  )
  expect(topOf(before, 'snp0')).toBe(0)

  const after = memo(
    new Map([[0, makeFeatureData({ features: [gene, ...marks] })]]),
    incInputs(20),
  )
  expect(topOf(after, 'gene')).toBe(0)
  expect(topOf(after, 'snp0')).toBeGreaterThan(0)
})

const pileRows = (spanBp: number, densityFade: boolean) => {
  const data = makeFeatureData({
    features: Array.from({ length: 25 }, (_, i) => ({
      featureId: `f${i}`,
      startBp: 100 + i,
      endBp: 100 + i + spanBp,
      height: 10,
      densityFade,
    })),
  })
  const out = layout(new Map([[0, data]]), 20, false)
  return Array.from(
    { length: 25 },
    (_, i) =>
      out.get(0)!.flatbushItems.find(it => it.featureId === `f${i}`)!.topPx,
  )
}

test('a pile deeper than a track collapses onto row 0, but only when sub-pixel', () => {
  expect(pileRows(1, true).every(t => t === 0)).toBe(true)
  expect(Math.max(...pileRows(1, false))).toBeGreaterThan(0)
  expect(Math.max(...pileRows(100, true))).toBeGreaterThan(0)
})

test('a pile one short of the bar keeps its rows', () => {
  const data = makeFeatureData({
    features: Array.from({ length: 24 }, (_, i) => ({
      featureId: `f${i}`,
      startBp: 100 + i,
      endBp: 101 + i,
      height: 10,
      densityFade: true,
    })),
  })
  const out = layout(new Map([[0, data]]), 20, false)
  const tops = out.get(0)!.flatbushItems.map(it => it.topPx)
  expect(new Set(tops).size).toBe(24)
})

test('a pair of sub-pixel fade boxes stacks instead of collapsing', () => {
  const data = makeFeatureData({
    features: [100, 101].map((startBp, i) => ({
      featureId: `f${i}`,
      startBp,
      endBp: startBp + 1,
      height: 10,
      densityFade: true,
    })),
  })
  const r = layout(new Map([[0, data]]), 1, false).get(0)!
  const top = (id: string) =>
    r.flatbushItems.find(it => it.featureId === id)!.topPx
  expect(top('f0')).toBe(0)
  expect(top('f1')).toBeGreaterThan(0)
  expect([...r.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('a pile books row 0, so a neighbour stacks above it instead of into it', () => {
  const data = makeFeatureData({
    features: [
      ...Array.from({ length: 25 }, (_, i) => ({
        featureId: `f${i}`,
        startBp: 100 + i,
        endBp: 101 + i,
      })),
      { featureId: 'edge', startBp: 160, endBp: 161 },
    ].map(f => ({ ...f, height: 10, densityFade: true })),
  })
  const r = layout(new Map([[0, data]]), 20, false).get(0)!
  const top = (id: string) =>
    r.flatbushItems.find(it => it.featureId === id)!.topPx
  expect(top('f0')).toBe(0)
  expect(top('edge')).toBeGreaterThan(0)
})

test('a hotspot does not drag the marks chained to it onto row 0', () => {
  const spread = Array.from({ length: 60 }, (_, i) => ({
    featureId: `s${i}`,
    startBp: 10000 + i * 75,
  }))
  const hotspot = Array.from({ length: 25 }, (_, i) => ({
    featureId: `h${i}`,
    startBp: 10000 + 30 * 75,
  }))
  const r = layout(
    new Map([
      [
        0,
        makeFeatureData({
          features: [...spread, ...hotspot].map(f => ({
            ...f,
            endBp: f.startBp + 1,
            height: 10,
            densityFade: true,
          })),
        }),
      ],
    ]),
    50,
    false,
  ).get(0)!
  const spreadTops = r.flatbushItems
    .filter(it => it.featureId.startsWith('s'))
    .map(it => it.topPx)
  expect(new Set(spreadTops).size).toBeGreaterThan(1)
  expect(spreadTops.filter(t => t > 0).length).toBeGreaterThan(20)
})

test('flattenRows packs a density band onto one row without dropping names', () => {
  const features = Array.from({ length: 12 }, (_, i) => ({
    featureId: `f${i}`,
    startBp: 100 + i * 3,
    endBp: 101 + i * 3,
    height: 10,
  }))
  const data = labeledFeatureData(features)
  const flat = computeLaidOutData(new Map([[0, data]]), {
    bpPerPx: 20,
    showLabels: true,
    showDescriptions: false,
    reversedRegions: new Set<number>(),
    displayMode: 'normal',
    pinnedFeatureIds: new Set<string>(),
    flattenRows: true,
  }).get(0)!
  expect(flat.flatbushItems.every(it => it.topPx === 0)).toBe(true)
  expect(flat.floatingLabelsData.size).toBe(12)
  const stacked = layout(new Map([[0, data]]), 20).get(0)!
  expect(
    new Set(stacked.flatbushItems.map(it => it.topPx)).size,
  ).toBeGreaterThan(1)
})

test('two piles whose painted spans merely touch stay two piles', () => {
  const pile = (n: number, at: number) =>
    Array.from({ length: 13 }, (_, i) => ({
      featureId: `p${n}_${i}`,
      startBp: at,
      endBp: at + 1,
      height: 10,
      densityFade: true,
    }))
  const data = makeFeatureData({
    features: [...pile(0, 1000), ...pile(1, 1000 + 2 * 20)],
  })
  const r = layout(new Map([[0, data]]), 20, false).get(0)!
  expect(new Set(r.flatbushItems.map(it => it.topPx)).size).toBeGreaterThan(1)
})

test('a shallow run beside a deep one keeps its rows, on either side', () => {
  const pile = Array.from({ length: 25 }, (_, i) => ({
    featureId: `f${i}`,
    startBp: 100 + i,
    endBp: 101 + i,
  }))
  for (const at of [20, 4000]) {
    const features = [
      ...pile,
      { featureId: 'p0', startBp: at, endBp: at + 1 },
      { featureId: 'p1', startBp: at + 10, endBp: at + 11 },
    ].map(f => ({ ...f, height: 10, densityFade: true }))
    const r = layout(
      new Map([[0, makeFeatureData({ features })]]),
      20,
      false,
    ).get(0)!
    const top = (id: string) =>
      r.flatbushItems.find(it => it.featureId === id)!.topPx
    expect(top('f0')).toBe(0)
    expect(top('p0')).toBe(0)
    expect(top('p1')).toBeGreaterThan(0)
  }
})

test('labeled sub-pixel fade boxes stack instead of collapsing onto row 0', () => {
  const data = makeFeatureData({
    features: [
      {
        featureId: 'mir1',
        startBp: 1000,
        endBp: 1070,
        height: 10,
        densityFade: true,
      },
      {
        featureId: 'mir2',
        startBp: 1100,
        endBp: 1170,
        height: 10,
        densityFade: true,
      },
    ],
  })
  data.floatingLabelsData = labelsMap({
    mir1: {
      featureId: 'mir1',
      minX: 1000,
      maxX: 1070,
      topY: 0,
      featureHeight: 10,
      nameLabel: {
        text: 'MIR6088',
        relativeY: 0,
        textWidth: 60,
      },
    },
    mir2: {
      featureId: 'mir2',
      minX: 1100,
      maxX: 1170,
      topY: 0,
      featureHeight: 10,
      nameLabel: {
        text: 'MIR769',
        relativeY: 0,
        textWidth: 55,
      },
    },
  })
  const noLabels = layout(new Map([[0, data]]), 26, false)
  const topNo = (id: string) =>
    noLabels.get(0)!.flatbushItems.find(f => f.featureId === id)!.topPx
  expect(topNo('mir1')).toBe(0)
  expect(topNo('mir2')).toBe(0)

  const withLabels = layout(new Map([[0, data]]), 26, true)
  const topYes = (id: string) =>
    withLabels.get(0)!.flatbushItems.find(f => f.featureId === id)!.topPx
  expect(topYes('mir1')).toBe(0)
  expect(topYes('mir2')).toBeGreaterThan(0)
})

test('a compact mode reserves label overhang at its own smaller font size', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'g1', startBp: 1000, endBp: 1070, height: 10 },
      { featureId: 'g2', startBp: 2470, endBp: 2540, height: 10 },
    ],
  })
  const label = (
    id: string,
    minX: number,
    maxX: number,
    textWidth: number,
  ) => ({
    featureId: id,
    minX,
    maxX,
    topY: 0,
    featureHeight: 10,
    nameLabel: { text: id, relativeY: 0, textWidth },
  })
  data.floatingLabelsData = labelsMap({
    g1: label('g1', 1000, 1070, 60),
    g2: label('g2', 2470, 2540, 55),
  })
  const topIn = (mode: 'normal' | 'superCompact', id: string) =>
    layout(new Map([[0, data]]), 26, true, false, new Set(), mode)
      .get(0)!
      .flatbushItems.find(f => f.featureId === id)!.topPx

  expect(topIn('normal', 'g2')).toBeGreaterThan(0)
  expect(topIn('superCompact', 'g1')).toBe(0)
  expect(topIn('superCompact', 'g2')).toBe(0)
})

test('an unlabeled sub-pixel box does not collapse onto a labeled one', () => {
  const data = makeFeatureData({
    features: [
      {
        featureId: 'rs123',
        startBp: 2000,
        endBp: 2001,
        height: 10,
        densityFade: true,
      },
      {
        featureId: 'unnamed',
        startBp: 2002,
        endBp: 2003,
        height: 10,
        densityFade: true,
      },
    ],
  })
  data.floatingLabelsData = labelsMap({
    rs123: {
      featureId: 'rs123',
      minX: 2000,
      maxX: 2001,
      topY: 0,
      featureHeight: 10,
      nameLabel: { text: 'rs123', relativeY: 0, textWidth: 40 },
    },
  })
  const out = layout(new Map([[0, data]]), 26, true)
  const top = (id: string) =>
    out.get(0)!.flatbushItems.find(f => f.featureId === id)!.topPx
  expect(top('rs123')).toBe(0)
  expect(top('unnamed')).toBeGreaterThan(0)
})

test('a sub-pixel fade box overlapping a visible feature stacks, not overprints', () => {
  const data = makeFeatureData({
    features: [
      {
        featureId: 'wideGene',
        startBp: 100,
        endBp: 5000,
        height: 12,
        densityFade: true,
      },
      {
        featureId: 'fakeSNP',
        startBp: 2000,
        endBp: 2001,
        height: 12,
        densityFade: true,
      },
    ],
  })
  const out = layout(new Map([[0, data]]), 26, false)
  const top = (id: string) =>
    out.get(0)!.flatbushItems.find(f => f.featureId === id)!.topPx
  expect(top('wideGene')).toBe(0)
  expect(top('fakeSNP')).toBeGreaterThan(0)
})

test('an interbase mark measures its collapse span centered, as it paints', () => {
  const insertionAt = (bp: number) =>
    makeFeatureData({
      features: [
        {
          featureId: 'gene',
          startBp: 50,
          endBp: 100,
          height: 12,
          densityFade: false,
        },
        {
          featureId: 'ins',
          startBp: bp,
          endBp: bp,
          height: 12,
          densityFade: true,
        },
      ],
    })
  const top = (data: LayoutRegionData) =>
    layout(new Map([[0, data]]), 1, false)
      .get(0)!
      .flatbushItems.find(f => f.featureId === 'ins')!.topPx

  expect(top(insertionAt(100))).toBeGreaterThan(0)
  expect(top(insertionAt(102))).toBe(0)
})

test('collapsed marks with clear space around them render opaque, not faded', () => {
  const data = makeFeatureData({
    features: Array.from({ length: 5 }, (_, i) => ({
      featureId: `snp${i}`,
      startBp: 100 + i * 100,
      endBp: 101 + i * 100,
      height: 10,
      densityFade: true,
    })),
  })
  const out = layout(new Map([[0, data]]), 1, false)
  expect([...out.get(0)!.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('a handful of sub-pixel marks take rows rather than needing a fade', () => {
  const data = makeFeatureData({
    features: Array.from({ length: 5 }, (_, i) => ({
      featureId: `snp${i}`,
      startBp: 100 + i,
      endBp: 101 + i,
      height: 10,
      densityFade: true,
    })),
  })
  const out = layout(new Map([[0, data]]), 26, false)
  const tops = out.get(0)!.flatbushItems.map(it => it.topPx)
  expect(new Set(tops).size).toBe(5)
  expect([...out.get(0)!.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('a collapsed pile fades without fading an isolated neighbour', () => {
  const data = makeFeatureData({
    features: [
      ...Array.from({ length: 25 }, (_, i) => ({
        featureId: `f${i}`,
        startBp: 100 + i,
        endBp: 101 + i,
      })),
      { featureId: 'lone', startBp: 12000, endBp: 12001 },
    ].map(f => ({ ...f, height: 10, densityFade: true })),
  })
  const out = layout(new Map([[0, data]]), 20, false)
  const items = out.get(0)!.flatbushItems
  const fadeOf = (id: string) =>
    out.get(0)!.rectDensityFade[items.findIndex(f => f.featureId === id)]
  expect(fadeOf('f0')).toBe(1)
  expect(fadeOf('f24')).toBe(1)
  expect(fadeOf('lone')).toBe(0)
})

test('two abutting marks stay opaque, so a coverage read survives', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'left', startBp: 100, endBp: 101, height: 10 },
      { featureId: 'right', startBp: 101, endBp: 102, height: 10 },
    ].map(f => ({ ...f, densityFade: true })),
  })
  const out = layout(new Map([[0, data]]), 1, false)
  expect([...out.get(0)!.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('a mark ending where another begins does not stack coverage with it', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'left', startBp: 100, endBp: 101, height: 10 },
      { featureId: 'mid', startBp: 101, endBp: 102, height: 10 },
      { featureId: 'right', startBp: 102, endBp: 103, height: 10 },
    ].map(f => ({ ...f, densityFade: true })),
  })
  const out = layout(new Map([[0, data]]), 1, false)
  expect([...out.get(0)!.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('a dense pileup of thousands of collapsed marks fades', () => {
  const N = 1500
  const data = makeFeatureData({
    features: Array.from({ length: N }, (_, i) => ({
      featureId: `snp${i}`,
      startBp: 100 + i * 3,
      endBp: 101 + i * 3,
      height: 10,
      densityFade: true,
    })),
  })
  const out = layout(new Map([[0, data]]), 100, false)
  const fade = out.get(0)!.rectDensityFade
  expect(fade).toHaveLength(N)
  expect([...fade].every(v => v === 1)).toBe(true)
})

test('a collapsed mark clears a solid neighbour at exactly the min-width clamp', () => {
  const N = 1200
  const marks = Array.from({ length: N }, (_, i) => ({
    featureId: `snp${i}`,
    startBp: 100 + i * 10,
    endBp: 101 + i * 10,
    height: 10,
    densityFade: true,
  }))
  const data = makeFeatureData({
    features: [
      ...marks,
      {
        featureId: 'probe',
        startBp: 19_997,
        endBp: 19_998,
        height: 10,
        densityFade: true,
      },
      {
        featureId: 'wideGene',
        startBp: 20_000,
        endBp: 21_000,
        height: 10,
        densityFade: false,
      },
    ],
  })
  const out = layout(new Map([[0, data]]), 1, false)
  const items = out.get(0)!.flatbushItems
  expect(items.slice(0, N).every(it => it.topPx === 0)).toBe(true)
  expect(items[N]!.topPx).toBe(0)
  expect(items[N + 1]!.topPx).toBe(0)
  expect([...out.get(0)!.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('thousands of sub-pixel variants collapse onto one row, not thousands', () => {
  const N = 5000
  const data = makeFeatureData({
    features: Array.from({ length: N }, (_, i) => ({
      featureId: `v${i}`,
      startBp: 1000 + i * 3,
      endBp: 1000 + i * 3 + 1,
      height: 10,
      densityFade: true,
    })),
  })
  const out = layout(new Map([[0, data]]), 100, false)
  const items = out.get(0)!.flatbushItems
  expect(items).toHaveLength(N)
  expect(items.every(it => it.topPx === 0)).toBe(true)
  expect(maxBottom(out)).toBe(items[0]!.bottomPx)
})

test('compact mode scales aminoAcidOverlay height alongside its top', () => {
  const data = {
    regionKey: 'v:ctgA',
    ...makeBaseFeatureData({
      flatbushItems: [
        makeFlatbushItem({
          featureId: 'cds',
          type: 'CDS',
          startBp: 100,
          endBp: 400,
          bottomPx: 20,
          featureHeightPx: 20,
        }),
      ],
      rectPositions: new Uint32Array([100, 400]),
      rectYs: new Float32Array([0]),
      rectHeights: new Float32Array([20]),
      rectColors: new Uint32Array([0]),
      rectStrands: new Float32Array([0]),
      rectDensityFade: new Uint32Array([0]),
      rectFeatureIndices: new Uint32Array([0]),
      aminoAcidOverlay: [
        {
          startBp: 100,
          endBp: 103,
          aminoAcid: 'M',
          proteinIndex: 0,
          topPx: 5,
          heightPx: 20,
          isStopOrNonTriplet: false,
          isTranslExcept: false,
          flatbushIdx: 0,
        },
      ],
    }),
  }
  const out = layout(
    new Map([[0, data]]),
    0.02,
    false,
    false,
    new Set<number>(),
    'compact',
  )
  const aa = out.get(0)!.aminoAcidOverlay![0]!
  expect(aa.heightPx).toBeCloseTo(12)
  expect(aa.topPx).toBeCloseTo(3)
})

test('scaleLaidOutData scales every Y and height by the fit factor', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const laid = layout(new Map([[0, data]]), 1, false, false)
  const before = maxBottom(laid)
  const scaled = scaleLaidOutData(laid, 0.5)

  expect(scaled.get(0)).not.toBe(laid.get(0))
  expect(maxBottom(laid)).toBe(before)

  expect(maxBottom(scaled)).toBeCloseTo(before / 2)
  const base = laid.get(0)!.flatbushItems
  const out = scaled.get(0)!.flatbushItems
  for (let i = 0; i < base.length; i++) {
    expect(out[i]!.topPx).toBeCloseTo(base[i]!.topPx * 0.5)
    expect(out[i]!.bottomPx).toBeCloseTo(base[i]!.bottomPx * 0.5)
    expect(out[i]!.featureHeightPx).toBeCloseTo(base[i]!.featureHeightPx * 0.5)
  }
  expect(out[0]).toBeDefined()
  const baseRectYs = laid.get(0)!.rectYs
  const outRectYs = scaled.get(0)!.rectYs
  for (let i = 0; i < baseRectYs.length; i++) {
    expect(outRectYs[i]).toBeCloseTo(baseRectYs[i]! * 0.5)
  }
})

describe('packedContentHeight matches the committed layout', () => {
  const overlapping = (count: number, height: number) =>
    labeledFeatureData(
      Array.from({ length: count }, (_, i) => ({
        featureId: `f${i}`,
        startBp: 100,
        endBp: 900,
        height,
      })),
    )

  const cases = [
    { reversed: false, displayMode: 'normal' as const },
    { reversed: true, displayMode: 'normal' as const },
    { reversed: false, displayMode: 'compact' as const },
    { reversed: true, displayMode: 'superCompact' as const },
    { reversed: false, displayMode: 'collapsed' as const },
  ]
  for (const { reversed, displayMode } of cases) {
    it(`agrees for ${displayMode}${reversed ? ' reversed' : ''}`, () => {
      const inputs = {
        bpPerPx: 1,
        showLabels: true,
        showDescriptions: false,
        reversedRegions: reversed ? new Set([0]) : new Set<number>(),
        displayMode,
        pinnedFeatureIds: new Set<string>(),
      }
      const data = new Map([[0, overlapping(6, 20)]])
      expect(packedContentHeight(data, inputs)).toBe(
        maxBottom(computeLaidOutData(data, inputs)),
      )
    })
  }

  it('stacks overlapping features onto distinct rows, compact tighter', () => {
    const base = {
      bpPerPx: 1,
      showLabels: true,
      showDescriptions: false,
      reversedRegions: new Set<number>(),
      pinnedFeatureIds: new Set<string>(),
    }
    const laid = computeLaidOutData(new Map([[0, overlapping(3, 20)]]), {
      ...base,
      displayMode: 'normal',
    }).get(0)!
    const tops = laid.flatbushItems.map(i => i.topPx)
    expect(new Set(tops).size).toBe(3)
    expect(Math.max(...tops)).toBeGreaterThan(0)
    expect(new Set(laid.rectYs).size).toBe(3)

    const compactH = packedContentHeight(new Map([[0, overlapping(3, 20)]]), {
      ...base,
      displayMode: 'compact',
    })
    expect(compactH).toBeLessThan(maxBottom(new Map([[0, laid]])))
  })
})

describe('featureIdsTouchingBlocks', () => {
  const region = (regionKey: string, spans: [string, number, number][]) => ({
    regionKey,
    flatbushItems: spans.map(([featureId, startBp, endBp]) => ({
      featureId,
      startBp,
      endBp,
    })),
  })
  const block = (refName: string, start: number, end: number) => ({
    assemblyName: 'volvox',
    refName,
    start,
    end,
  })

  it('takes a feature overlapping the block and leaves one that merely abuts it', () => {
    const ids = featureIdsTouchingBlocks(
      [
        region('volvox:ctgA', [
          ['before', 50, 100],
          ['overlapsStart', 90, 110],
          ['inside', 120, 130],
          ['overlapsEnd', 190, 210],
          ['after', 200, 260],
        ]),
      ],
      [block('ctgA', 100, 200)],
    )
    expect([...ids].sort()).toEqual(['inside', 'overlapsEnd', 'overlapsStart'])
  })

  it('matches regions to blocks by ref, not by index, and unions several blocks', () => {
    const regions = [
      region('volvox:ctgA', [['a', 0, 10]]),
      region('volvox:ctgB', [['b', 0, 10]]),
    ]
    expect([
      ...featureIdsTouchingBlocks(regions, [block('ctgA', 0, 5)]),
    ]).toEqual(['a'])
    expect(
      [
        ...featureIdsTouchingBlocks(regions, [
          block('ctgA', 0, 5),
          block('ctgB', 5, 20),
        ]),
      ].sort(),
    ).toEqual(['a', 'b'])
    expect([
      ...featureIdsTouchingBlocks(regions, [
        { assemblyName: 'other', refName: 'ctgA', start: 0, end: 10 },
      ]),
    ]).toEqual([])
  })

  it('is empty with no blocks at all', () => {
    expect(
      featureIdsTouchingBlocks([region('volvox:ctgA', [['a', 0, 10]])], [])
        .size,
    ).toBe(0)
  })
})
