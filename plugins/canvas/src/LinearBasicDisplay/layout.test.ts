import {
  LAYOUT_Y_PADDING,
  computeLaidOutData,
  createIncrementalLayout,
} from './layout.ts'
import { LABEL_FONT_SIZE } from '../RenderFeatureDataRPC/constants.ts'
import {
  makeFeatureData as makeBaseFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

function makeFeatureData(opts: {
  features: {
    featureId: string
    startBp: number
    endBp: number
    height: number
    strand?: number
    densityFade?: boolean
  }[]
}): FeatureDataResult {
  const { features } = opts
  return makeBaseFeatureData({
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
    rectPositions: new Uint32Array(features.flatMap(f => [f.startBp, f.endBp])),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.map(f => f.height)),
    rectColors: new Uint32Array(features.length),
    rectStrands: new Float32Array(features.length),
    rectDensityFade: new Uint32Array(
      features.map(f => (f.densityFade ? 1 : 0)),
    ),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
  })
}

function layout(
  raw: Map<number, FeatureDataResult>,
  regionKeys: Map<number, string>,
  bpPerPx: number,
  showLabels = true,
  showDescriptions = true,
  reversedRegions = new Set<number>(),
  displayMode: 'normal' | 'compact' | 'superCompact' = 'normal',
) {
  return computeLaidOutData(raw, {
    bpPerPx,
    regionKeys,
    showLabels,
    showDescriptions,
    reversedRegions,
    displayMode,
    pinnedFeatureIds: new Set<string>(),
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
  const featureHeight = 10
  const withLabels = layout(new Map([[0, mk()]]), keys, 1, true, true)
  expect(withLabels.get(0)!.flatbushItems[0]!.bottomPx).toBe(
    featureHeight + LAYOUT_Y_PADDING + LABEL_FONT_SIZE * 2,
  )

  const withoutLabels = layout(new Map([[0, mk()]]), keys, 1, false, false)
  expect(withoutLabels.get(0)!.flatbushItems[0]!.bottomPx).toBe(
    featureHeight + LAYOUT_Y_PADDING,
  )

  // showLabels=false but showDescriptions=true: description is collapsed up
  // into the vacated name row at relativeY=0 (see useOverlayElements), so it
  // still occupies one row of height below the feature.
  const descOnly = layout(new Map([[0, mk()]]), keys, 1, false, true)
  expect(descOnly.get(0)!.flatbushItems[0]!.bottomPx).toBe(
    featureHeight + LAYOUT_Y_PADDING + LABEL_FONT_SIZE,
  )
})

test("forward feature's right arrow overhang pushes a feature in its gap to another row", () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20, strand: 1 },
      // starts 4bp past f1's end, inside the 8px right arrow overhang
      { featureId: 'f2', startBp: 204, endBp: 300, height: 20, strand: 1 },
    ],
  })
  const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1)
  expect(out.get(0)!.flatbushItems[1]!.topPx).toBeGreaterThan(0)
})

test('arrow padding is directional: forward features just past the arrow share a row', () => {
  const data = makeFeatureData({
    features: [
      { featureId: 'f1', startBp: 100, endBp: 200, height: 20, strand: 1 },
      // starts past f1's 8px right arrow; f2 has no left arrow, so they pack
      { featureId: 'f2', startBp: 220, endBp: 300, height: 20, strand: 1 },
    ],
  })
  const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1)
  expect(out.get(0)!.flatbushItems[0]!.topPx).toBe(0)
  expect(out.get(0)!.flatbushItems[1]!.topPx).toBe(0)
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

// Stable empty set: the model's pinnedFeatureIdSet is a MobX-cached getter with
// a stable reference, so the incremental memo relies on reference identity to
// detect a pin change. A fresh set per call would spuriously bust the cache.
const NO_PINNED: ReadonlySet<string> = new Set<string>()

function incInputs(
  regionKeys: Map<number, string>,
  bpPerPx = 1,
  reversedRegions = new Set<number>(),
  pinnedFeatureIds: ReadonlySet<string> = NO_PINNED,
) {
  return {
    bpPerPx,
    regionKeys,
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
  })
  const raw = new Map([
    [0, a],
    [1, b],
  ])
  const keys = new Map([
    [0, 'v:ctgA'],
    [1, 'v:ctgB'],
  ])
  const pure = computeLaidOutData(raw, incInputs(keys))
  const inc = createIncrementalLayout()(raw, incInputs(keys))

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
  const keys = new Map([[0, 'v:ctgA']])
  const first = memo(new Map([[0, a]]), incInputs(keys))
  const aOut = first.get(0)

  const b = makeFeatureData({
    features: [{ featureId: 'f3', startBp: 100, endBp: 500, height: 20 }],
  })
  keys.set(1, 'v:ctgB')
  const second = memo(
    new Map([
      [0, a],
      [1, b],
    ]),
    incInputs(keys),
  )

  // ctgA's data did not change → its output object is reused by reference, so
  // the GPU upload autorun can skip re-uploading it.
  expect(second.get(0)).toBe(aOut)
  expect(second.get(1)).toBeDefined()
})

test('incremental memo: changing a region recomputes its group', () => {
  const memo = createIncrementalLayout()
  const mk = () =>
    makeFeatureData({
      features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
    })
  const keys = new Map([[0, 'v:ctgA']])
  const first = memo(new Map([[0, mk()]]), incInputs(keys))
  const second = memo(new Map([[0, mk()]]), incInputs(keys))
  expect(second.get(0)).not.toBe(first.get(0))
})

test('incremental memo: bpPerPx change recomputes every group', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const keys = new Map([[0, 'v:ctgA']])
  const first = memo(new Map([[0, a]]), incInputs(keys, 1))
  const second = memo(new Map([[0, a]]), incInputs(keys, 2))
  expect(second.get(0)).not.toBe(first.get(0))
})

test('incremental memo: a region added to an existing ref-group recomputes that group', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const keys = new Map([[0, 'v:ctgA']])
  const first = memo(new Map([[0, a]]), incInputs(keys))

  const b = makeFeatureData({
    features: [{ featureId: 'f2', startBp: 600, endBp: 900, height: 20 }],
  })
  // same key → same ref-group; a spanning feature could shift rows, so the
  // whole group must relay out (its references change).
  keys.set(1, 'v:ctgA')
  const second = memo(
    new Map([
      [0, a],
      [1, b],
    ]),
    incInputs(keys),
  )
  expect(second.get(0)).not.toBe(first.get(0))
})

test('incremental memo: flipping a region reversed recomputes its group', () => {
  const memo = createIncrementalLayout()
  const a = makeFeatureData({
    features: [{ featureId: 'f1', startBp: 100, endBp: 500, height: 20 }],
  })
  const keys = new Map([[0, 'v:ctgA']])
  const first = memo(new Map([[0, a]]), incInputs(keys, 1, new Set()))
  const second = memo(new Map([[0, a]]), incInputs(keys, 1, new Set([0])))
  expect(second.get(0)).not.toBe(first.get(0))
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

test('a feature compacts up to a freed row on zoom-in (no downward hold)', () => {
  // A's 300px name label overhangs B at bpPerPx=2 (300 > 400/2) but not at
  // bpPerPx=1 (300 < 400/1), so zooming in frees row 0 under B. Through the
  // incremental memo (which once seeded from the prior layout) B must now rise
  // to row 0 rather than being held on its old lower row.
  const withNameLabel = (
    data: FeatureDataResult,
    id: string,
    width: number,
  ) => {
    data.floatingLabelsData[id] = {
      featureId: id,
      minX: 0,
      maxX: 0,
      topY: 0,
      featureHeight: 10,
      nameLabel: { text: id, relativeY: 0, color: 'black', textWidth: width },
    }
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
  const keys = new Map([[0, 'v:ctgA']])
  const memo = createIncrementalLayout()

  expect(bTop(memo(new Map([[0, mk()]]), incInputs(keys, 2)))).toBeGreaterThan(
    0,
  )
  expect(bTop(memo(new Map([[0, mk()]]), incInputs(keys, 1)))).toBe(0)
})

test('re-pack orders by prior y so a top feature keeps its low row', () => {
  // A and B overlap in x, so one stacks on the other. A sorts first by x, so a
  // fresh (unprimed) layout gives A the top row. Priming B as the prior top
  // feature flips the insertion order so B claims the top row instead — proving
  // a feature that was near the top keeps its low row across a re-pack.
  const mk = () =>
    makeFeatureData({
      features: [
        { featureId: 'A', startBp: 1000, endBp: 2000, height: 20 },
        { featureId: 'B', startBp: 1500, endBp: 2500, height: 20 },
      ],
    })
  const keys = new Map([[0, 'v:ctgA']])
  const topOf = (r: Map<number, FeatureDataResult>, id: string) =>
    r.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx

  const fresh = computeLaidOutData(new Map([[0, mk()]]), incInputs(keys, 1))
  expect(topOf(fresh, 'A')).toBe(0)
  expect(topOf(fresh, 'B')).toBeGreaterThan(0)

  const primed = computeLaidOutData(
    new Map([[0, mk()]]),
    incInputs(keys, 1),
    new Map([
      ['B', 0],
      ['A', 100],
    ]),
  )
  expect(topOf(primed, 'B')).toBe(0)
  expect(topOf(primed, 'A')).toBeGreaterThan(0)
})

test('a pinned feature claims the top row over its overlappers', () => {
  // A and B overlap in x, so one stacks on the other. Unpinned, A sorts first
  // by x and takes the top row. Pinning B sorts it ahead of everything, so it
  // claims row 0 and A stacks below — even though A still sorts earlier by x.
  const mk = () =>
    makeFeatureData({
      features: [
        { featureId: 'A', startBp: 1000, endBp: 2000, height: 20 },
        { featureId: 'B', startBp: 1500, endBp: 2500, height: 20 },
      ],
    })
  const keys = new Map([[0, 'v:ctgA']])
  const topOf = (r: Map<number, FeatureDataResult>, id: string) =>
    r.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx

  const unpinned = computeLaidOutData(new Map([[0, mk()]]), incInputs(keys, 1))
  expect(topOf(unpinned, 'A')).toBe(0)
  expect(topOf(unpinned, 'B')).toBeGreaterThan(0)

  const pinnedB = computeLaidOutData(
    new Map([[0, mk()]]),
    incInputs(keys, 1, new Set<number>(), new Set(['B'])),
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
  const keys = new Map([[0, 'v:ctgA']])
  const topOf = (r: Map<number, FeatureDataResult>, id: string) =>
    r.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx
  const memo = createIncrementalLayout()

  const before = memo(new Map([[0, mk()]]), incInputs(keys, 1))
  const beforeOut = before.get(0)
  expect(topOf(before, 'A')).toBe(0)

  // Same params but a new pinned set including B → group re-packs (output object
  // is not reused) and B takes the top row.
  const after = memo(
    new Map([[0, mk()]]),
    incInputs(keys, 1, new Set<number>(), new Set(['B'])),
  )
  expect(after.get(0)).not.toBe(beforeOut)
  expect(topOf(after, 'B')).toBe(0)
})

test('density-fade boxes collapse onto row 0 only when sub-pixel', () => {
  // Two abutting boxes at bpPerPx=1; the 1px inter-feature padding makes them
  // collide, so first-fit stacks the second onto its own row unless collapsed.
  const rows = (spanBp: number, densityFade: boolean) => {
    const data = makeFeatureData({
      features: [
        {
          featureId: 'a',
          startBp: 100,
          endBp: 100 + spanBp,
          height: 10,
          densityFade,
        },
        {
          featureId: 'b',
          startBp: 100 + spanBp,
          endBp: 100 + 2 * spanBp,
          height: 10,
          densityFade,
        },
      ],
    })
    const out = layout(new Map([[0, data]]), new Map([[0, 'v:ctgA']]), 1, false)
    const top = (id: string) =>
      out.get(0)!.flatbushItems.find(it => it.featureId === id)!.topPx
    return [top('a'), top('b')]
  }

  // sub-pixel (1px < the 2px clamp) + fade → both collapse onto the shared row
  expect(rows(1, true)).toEqual([0, 0])
  // same geometry, not a fade box (e.g. gene subfeature rects) → still stacks
  expect(rows(1, false)[1]).toBeGreaterThan(0)
  // fade box but wide (20px > clamp) → a real box, stacks normally
  expect(rows(20, true)[1]).toBeGreaterThan(0)
})

test('a sub-pixel fade box overlapping a visible feature stacks, not overprints', () => {
  // A 1bp SNP sitting inside a wide gene box: both are density-fade boxes, but
  // only the SNP is sub-pixel. Pinning it to row 0 would draw it on top of the
  // wide gene (also at row 0), so it must stack instead. Regression for the
  // observed genes-track collision.
  const data = makeFeatureData({
    features: [
      { featureId: 'wideGene', startBp: 100, endBp: 5000, height: 12, densityFade: true },
      { featureId: 'fakeSNP', startBp: 2000, endBp: 2001, height: 12, densityFade: true },
    ],
  })
  const out = layout(new Map([[0, data]]), new Map([[0, 'volvox:ctgA']]), 26, false)
  const top = (id: string) =>
    out.get(0)!.flatbushItems.find(f => f.featureId === id)!.topPx
  expect(top('wideGene')).toBe(0)
  expect(top('fakeSNP')).toBeGreaterThan(0)
})
