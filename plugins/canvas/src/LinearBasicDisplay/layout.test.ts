import { computeLaidOutData } from './layout.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

function makeFeatureData(opts: {
  features: {
    featureId: string
    startBp: number
    endBp: number
    height: number
    strand?: number
  }[]
}): FeatureDataResult {
  const { features } = opts
  return {
    flatbushItems: features.map(f => ({
      kind: 'feature' as const,
      featureId: f.featureId,
      type: 'feature',
      startBp: f.startBp,
      endBp: f.endBp,
      topPx: 0,
      bottomPx: f.height,
      featureHeightPx: f.height,
      tooltip: f.featureId,
      strand: f.strand,
    })),
    subfeatureInfos: [],
    floatingLabelsData: {},
    rectPositions: new Uint32Array(features.flatMap(f => [f.startBp, f.endBp])),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.map(f => f.height)),
    rectColors: new Uint32Array(features.length),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
    linePositions: new Uint32Array(0),
    lineYs: new Float32Array(0),
    lineColors: new Uint32Array(0),
    lineDirections: new Int8Array(0),
    lineFeatureIndices: new Uint32Array(0),
    arrowXs: new Uint32Array(0),
    arrowYs: new Float32Array(0),
    arrowDirections: new Int8Array(0),
    arrowColors: new Uint32Array(0),
    arrowFeatureIndices: new Uint32Array(0),
    outlineColor: 0,
    featureCount: 0,
  }
}

function layout(
  raw: Map<number, FeatureDataResult>,
  regionKeys: Map<number, string>,
  bpPerPx: number,
  showLabels = true,
  showDescriptions = true,
  reversedRegions?: Set<number>,
) {
  return computeLaidOutData(raw, {
    bpPerPx,
    regionKeys,
    showLabels,
    showDescriptions,
    reversedRegions,
  })
}

test('layout is pure: raw data is not mutated', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const raw = new Map([[0, data]])
  const regionKeys = new Map([[0, 'volvox:ctgA']])

  const out = layout(raw, regionKeys, 1)

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
  const out = layout(new Map([[0, data]]), new Map([[0, 'volvox:ctgA']]), 1)

  const r = out.get(0)!
  expect(r.flatbushItems[0]!.topPx).toBe(0)
  expect(r.flatbushItems[1]!.topPx).toBeGreaterThan(0)
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
  })
  const out = layout(
    new Map([
      [0, a],
      [1, b],
    ]),
    new Map([
      [0, 'v:ctgA'],
      [1, 'v:ctgB'],
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
    new Map([
      [0, 'hg38:chr1'],
      [1, 'hg38:chr1'],
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
  const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1)
  const r = out.get(0)!
  expect(r.flatbushItems[0]!.topPx).toBe(0)
  expect(r.flatbushItems[1]!.topPx).toBe(0)
})

test('same inputs produce identical output (deterministic)', () => {
  const mk = () =>
    makeFeatureData({
      features: [
        { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
        { featureId: 'f2', startBp: 200, endBp: 600, height: 25 },
      ],
    })
  const keys = new Map([[0, 'v:ctgA']])
  const a = layout(new Map([[0, mk()]]), keys, 1)
  const b = layout(new Map([[0, mk()]]), keys, 1)

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
  const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1)
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
  data.floatingLabelsData = {
    f1: {
      featureId: 'f1',
      minX: 100,
      maxX: 200,
      topY: 0,
      featureHeight: 20,
      nameLabel: { text: 'L1', relativeY: 0, color: 'black', textWidth: 300 },
    },
    f2: {
      featureId: 'f2',
      minX: 300,
      maxX: 400,
      topY: 0,
      featureHeight: 20,
      nameLabel: { text: 'L2', relativeY: 0, color: 'black', textWidth: 300 },
    },
  }
  const keys = new Map([[0, 'v:ctgA']])
  // Zoomed out: labels are 300bp wide → features overlap → different rows
  const zoomedOut = layout(new Map([[0, data]]), keys, 1)
  const zo = zoomedOut.get(0)!
  expect(zo.flatbushItems[0]!.topPx).not.toBe(zo.flatbushItems[1]!.topPx)

  // Zoomed in: labels are 30bp wide → no overlap → same row
  const zoomedIn = layout(new Map([[0, data]]), keys, 0.1)
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
  data.floatingLabelsData = {
    gene2: {
      featureId: 'gene2',
      minX: 200,
      maxX: 600,
      topY: 0,
      featureHeight: 30,
      nameLabel: {
        text: 'Gene 2',
        relativeY: 0,
        color: 'black',
        textWidth: 50,
      },
    },
  }

  const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1)
  const r = out.get(0)!
  const gene2Top = r.flatbushItems[1]!.topPx
  expect(gene2Top).toBeGreaterThan(0)
  expect(r.subfeatureInfos[0]!.topPx).toBe(5 + gene2Top)
  expect(r.subfeatureInfos[0]!.bottomPx).toBe(15 + gene2Top)
  expect(r.floatingLabelsData.gene2!.topY).toBe(gene2Top)
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
  data.lineColors = new Uint32Array([0xff000000])
  data.lineDirections = new Int8Array([1])
  data.lineFeatureIndices = new Uint32Array([1])
  data.arrowXs = new Uint32Array([600])
  data.arrowYs = new Float32Array([10])
  data.arrowDirections = new Int8Array([1])
  data.arrowColors = new Uint32Array([0xff000000])
  data.arrowFeatureIndices = new Uint32Array([1])

  const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1)
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
    data.floatingLabelsData = {
      f1: {
        featureId: 'f1',
        minX: 100,
        maxX: 500,
        topY: 0,
        featureHeight: 10,
        nameLabel: {
          text: 'Gene 1',
          relativeY: 0,
          color: 'black',
          textWidth: 50,
        },
        descriptionLabel: {
          text: 'A description',
          relativeY: 12,
          color: 'blue',
          textWidth: 80,
        },
      },
    }
    return data
  }

  const keys = new Map([[0, 'v:ctgA']])
  const withLabels = layout(new Map([[0, mk()]]), keys, 1, true, true)
  // height 10 + 5 padding + 12 name + 12 description = 39
  expect(withLabels.get(0)!.flatbushItems[0]!.bottomPx).toBe(39)

  const withoutLabels = layout(new Map([[0, mk()]]), keys, 1, false, false)
  // height 10 + 5 padding = 15
  expect(withoutLabels.get(0)!.flatbushItems[0]!.bottomPx).toBe(15)

  // showLabels=false but showDescriptions=true: description is collapsed up
  // into the vacated name row at relativeY=0 (see useOverlayElements), so it
  // still occupies one row of height below the feature.
  const descOnly = layout(new Map([[0, mk()]]), keys, 1, false, true)
  // height 10 + 5 padding + 12 description = 27
  expect(descOnly.get(0)!.flatbushItems[0]!.bottomPx).toBe(27)
})

test('strand arrow padding prevents adjacent stranded features from sharing a row', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20, strand: 1 },
      { featureId: 'f2', startBp: 208, endBp: 300, height: 20, strand: 1 },
    ],
  })
  const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1)
  expect(out.get(0)!.flatbushItems[1]!.topPx).toBeGreaterThan(0)
})

test('unstranded features without arrow padding can share a row when close', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20 },
      { featureId: 'f2', startBp: 220, endBp: 300, height: 20 },
    ],
  })
  const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1)
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
    // Long label on fLabel (300 px wide) — overhangs ~300 bp at bpPerPx=1.
    data.floatingLabelsData = {
      fLabel: {
        featureId: 'fLabel',
        minX: 200,
        maxX: 250,
        topY: 0,
        featureHeight: 10,
        nameLabel: { text: 'L', relativeY: 0, color: 'black', textWidth: 300 },
      },
    }
    return data
  }

  const keys = new Map([[0, 'v:ctgA']])

  // Forward: label extends toward higher bp; fLeft (bp 50-100) doesn't collide.
  const fwd = layout(new Map([[0, mk()]]), keys, 1, true, true)
  expect(fwd.get(0)!.flatbushItems[0]!.topPx).toBe(0)
  expect(fwd.get(0)!.flatbushItems[1]!.topPx).toBe(0)

  // Reversed: label extends toward lower bp; collides with fLeft → different rows.
  const rev = layout(new Map([[0, mk()]]), keys, 1, true, true, new Set([0]))
  const rLeft = rev.get(0)!.flatbushItems[0]!
  const rLabel = rev.get(0)!.flatbushItems[1]!
  expect(rLeft.topPx).not.toBe(rLabel.topPx)
})

test('incremental: adding a new region does not move features in existing regions', () => {
  const a = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 500, height: 20 },
      { featureId: 'f2', startBp: 200, endBp: 600, height: 20 },
    ],
  })
  const keys = new Map([[0, 'v:ctgA']])
  const first = layout(new Map([[0, a]]), keys, 1)
  const aFirst = first.get(0)!
  const f1Top = aFirst.flatbushItems[0]!.topPx
  const f2Top = aFirst.flatbushItems[1]!.topPx

  const b = makeFeatureData({
    features: [{ featureId: 'f3', startBp: 100, endBp: 500, height: 20 }],
  })
  keys.set(1, 'v:ctgB')
  const second = layout(
    new Map([
      [0, a],
      [1, b],
    ]),
    keys,
    1,
  )

  expect(second.get(0)!.flatbushItems[0]!.topPx).toBe(f1Top)
  expect(second.get(0)!.flatbushItems[1]!.topPx).toBe(f2Top)
  expect(second.get(1)!.flatbushItems[0]!.topPx).toBe(0)
})
