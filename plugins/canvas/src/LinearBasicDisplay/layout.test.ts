import { LABEL_FONT_SIZE } from '../RenderFeatureDataRPC/constants.ts'
import { ROW_PADDING } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import {
  labelsMap,
  makeFeatureData as makeBaseFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  computeLaidOutData,
  createContentHeightProbe,
  packedContentHeight,
  createIncrementalLayout,
  featureIdsTouchingBlocks,
  maxBottom,
  scaleLaidOutData,
} from './layout.ts'

import type {
  FeatureDataResult,
  FloatingLabelsDataMap,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LayoutRegionData } from './layout.ts'

function makeFeatureData(opts: {
  features: {
    featureId: string
    startBp: number
    endBp: number
    height: number
    strand?: number
    densityFade?: boolean
  }[]
  // `assembly:refName`. The layout groups by it, so a test needs two only when
  // it is about two chromosomes; every other test wants one and does not care
  // which, which is why it defaults rather than being threaded through.
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

// Same as makeFeatureData but attaches a name label of the given text width to
// every feature, so the layout reserves a name line + overhang (and the fitWidth
// decimation has something to keep or drop).
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

// The reserved label width is textWidth + LABEL_PADDING_PX (6); at bpPerPx 1 a
// box is (endBp - startBp) px wide. A name overhangs rightward past its box into
// the whitespace before the next feature, so `fitWidth` keeps it when the box
// plus that gap (>= 46px here) can host it and drops it only where a neighbor
// crowds it out.
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

  // Whether a feature's NAME survived decimation. A decimated feature keeps its
  // floatingLabelsData entry (its description and subfeature label still draw and
  // still have reserved space) and loses only `nameLabel`, so presence of the
  // entry is not the question — presence of the name is.
  const keptName = (labels: FloatingLabelsDataMap, featureId: string) =>
    labels.get(featureId)?.nameLabel !== undefined

  // `crowded` (10px box) is followed 5px later by `blocker`, leaving 5px < 46px
  // of overhang room, so its name is dropped; `blocker` itself is the last
  // feature with open space to its right, so its name is kept.
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
    // A lone narrow box whose name is far wider than the box keeps its name:
    // nothing crowds the rightward overhang. The box-width-only rule wrongly
    // dropped this.
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
    // A dense run of narrow boxes at 5px pitch: each name (46px reserved) is
    // crowded by its right neighbor, so `all` reserves a name line on every row
    // while `fitWidth` drops all but the last (which has open space).
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

  // A 40px name reserves 40 + LABEL_PADDING_PX (6) = 46px. At bpPerPx 1 the
  // overhang room is the neighbor's start minus this feature's start (px), so the
  // keep/drop boundary sits exactly at a 46px gap.
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

  // The decision keys on available room, not box width: keeping a name only
  // shrinks (never grows) as its neighbor crowds in, so the kept set is monotone
  // in the gap. The old box-width-only rule dropped `probe` at every gap (its
  // 10px box never hosts the 46px name); the overhang rule keeps it wherever the
  // gap does.
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
    // once kept as the gap widens, stays kept (no true precedes a later false)
    expect(kept).toStrictEqual([...kept].sort((a, b) => Number(a) - Number(b)))
    expect(kept.at(-1)).toBe(true)
    expect(kept[0]).toBe(false)
  })

  // labelRoomFactor is the fit ladder's gradual knob: a higher factor demands
  // proportionally more overhang room, so the tighter decimated rungs keep fewer
  // names. `probe` has exactly 46px of room — enough at factor 1 (needs 46) and
  // factor 2 would need 92, so it sheds — while a name with 100px of room
  // survives factor 2 but not factor 4 (needs 184).
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
    // Sub-1 factors keep MORE names: a name with 30px room (< its 46px width) is
    // dropped at factor 1 but kept at 0.5 (needs 23) and 0.25 (needs ~11.5) —
    // the rungs that fill spare vertical space with crowded names.
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

  // Reversed regions overhang the name leftward (toward lower bp; see the
  // layoutStartBp reservation), so room is measured to the left neighbor's right
  // edge. Mirrors the forward case.
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

  // Features stacked on one bp share their start, so none has whitespace of its
  // own to the right: the next left edge is its own. Measured to the next
  // DISTINCT start instead, every member of the pile read the whole gap to the
  // far neighbor as room, kept its name at any factor, and the solve found no
  // factor that fits.
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
  // Same overlapping features as the test above, but collapsed pins both to
  // row 0 instead of stacking f2 below f1. Labels are forced off upstream in
  // collapsed mode, so pass showLabels/showDescriptions false.
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

// Collapsed mode is where row 0 is the only row, so marks sharing a pixel column
// are guaranteed to be drawn over each other — the case the pileup fade exists
// for, and the one this mode used to draw as a single opaque bar.
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

// The next two pin PILEUP_FADE_DEPTH from both sides in the mode that motivated
// it, at the geometry that motivated it. Collapsed mode admits every sub-pixel
// mark as a fade candidate — unlike the stacking path, it cannot hold labeled or
// solid-overlapping ones back, since row 0 is the only row — so it is the mode
// where a threshold that is too low does the most damage, and it is the mode
// website/scripts/specs/graph.ts's repeat lane runs in.
//
// 200bp elements at 150 bp/px: 1.33px each, under the 2px clamp, so each paints
// exactly 2px from its start.
test('collapsed mode leaves abutting repeat-style elements opaque', () => {
  // Neighbouring RepeatMasker elements: disjoint in bp, touching or nearly so,
  // which the clamp turns into a painted overlap. That is ordinary tiled
  // annotation and not a pile, and a lane read for how much of the interval is
  // covered needs it solid — faded, its denser stretches render LIGHTER than its
  // sparse ones, because two marks at MIN_DENSITY_ALPHA accumulate to 0.51 where
  // a lone mark draws 1.0.
  const data = makeFeatureData({
    features: [
      // paints [6.67,8.67) and [8.0,10.0) — abutting in bp, overlapping in px
      { featureId: 'rep0', startBp: 1000, endBp: 1200, height: 10 },
      { featureId: 'rep1', startBp: 1200, endBp: 1400, height: 10 },
      // paints [10.67,12.67), clear of both
      { featureId: 'rep2', startBp: 1600, endBp: 1800, height: 10 },
    ].map(f => ({ ...f, densityFade: true })),
  })
  const r = collapsedModeLayout(data, 150)
  expect(r.flatbushItems.every(it => it.topPx === 0)).toBe(true)
  expect([...r.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('collapsed mode fades the same elements once a third lands on them', () => {
  // One element further into the same 2px and the clamp is no longer an
  // explanation: three marks cover x=8.0, which no zoom short of base level can
  // resolve and which draws as one opaque bar with two features silently gone.
  const data = makeFeatureData({
    features: [
      // paint [6.67,8.67), [7.33,9.33) and [8.0,10.0) — all three cover 8.0
      { featureId: 'rep0', startBp: 1000, endBp: 1200, height: 10 },
      { featureId: 'rep1', startBp: 1100, endBp: 1300, height: 10 },
      { featureId: 'rep2', startBp: 1200, endBp: 1400, height: 10 },
    ].map(f => ({ ...f, densityFade: true })),
  })
  const r = collapsedModeLayout(data, 150)
  expect([...r.rectDensityFade].every(v => v === 1)).toBe(true)
})

test('collapsed mode leaves three overlapping wide boxes opaque', () => {
  // The fade is for sub-pixel marks, whose ~2px box IS its own overlap. A wide
  // box overlaps its neighbour over PART of its length, and one instance alpha
  // would ghost it end to end to report a collision at one end. Three of them
  // cover a point PILEUP_FADE_DEPTH deep, so only the sub-pixel test holds the
  // fade off — and collapsed mode, where every box shares row 0, is where that
  // can happen.
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
  // A ~2px mark is its own overlap, so one instance alpha reads as the pileup's
  // depth. A gene overlaps its neighbour over part of its length, and fading the
  // instance would ghost it end to end to report a collision at one end — so the
  // fade stays keyed to the sub-pixel test even in the mode that piles
  // everything onto row 0 regardless of width.
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
  // The shape a zoom-in produces: the fetch that covered the zoomed-out view is
  // still what the packer sees, so a 1.1Mb gene ending 400kb to the left of the
  // viewport is in the pack. At 13.6 bpPerPx it is 84,000px wide, past the pitch
  // width GranularRectLayout used to read as "fills every row it is on".
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
  // Zoomed out: labels are 300bp wide → features overlap → different rows
  const zoomedOut = layout(new Map([[0, data]]), 1)
  const zo = zoomedOut.get(0)!
  expect(zo.flatbushItems[0]!.topPx).not.toBe(zo.flatbushItems[1]!.topPx)

  // Zoomed in: labels are 30bp wide → no overlap → same row
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

  // showLabels=false but showDescriptions=true: description is collapsed up
  // into the vacated name row at relativeY=0 (see overlayElements), so it
  // still occupies one row of height below the feature.
  const descOnly = layout(new Map([[0, mk()]]), 1, false, true)
  expect(descOnly.get(0)!.flatbushItems[0]!.bottomPx).toBe(
    featureHeight + ROW_PADDING.normal + LABEL_FONT_SIZE,
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
  const out = layout(new Map([[0, data]]), 1)
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
  const out = layout(new Map([[0, data]]), 1)
  expect(out.get(0)!.flatbushItems[0]!.topPx).toBe(0)
  expect(out.get(0)!.flatbushItems[1]!.topPx).toBe(0)
})

test('a feature too narrow to draw its arrow reserves no room for one', () => {
  // Both backends drop the direction marker under ARROW_MIN_FEATURE_WIDTH_PX
  // (arrow.slang's gate and Canvas2D's twin of it), so reserving the 8px overhang
  // there holds space nothing paints into. bpPerPx=1, so bp are px: two forward
  // features 3px apart, sized either side of the 14px gate. Wide, f1's arrow
  // draws and its overhang pushes f2 off the row; narrow, nothing paints into
  // that 8px and the pair shares one row.
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
    // Long label on fLabel (300 px wide) — overhangs ~300 bp at bpPerPx=1.
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

  // Forward: label extends toward higher bp; fLeft (bp 50-100) doesn't collide.
  const fwd = layout(new Map([[0, mk()]]), 1, true, true)
  expect(fwd.get(0)!.flatbushItems[0]!.topPx).toBe(0)
  expect(fwd.get(0)!.flatbushItems[1]!.topPx).toBe(0)

  // Reversed: label extends toward lower bp; collides with fLeft → different rows.
  const rev = layout(new Map([[0, mk()]]), 1, true, true, new Set([0]))
  const rLeft = rev.get(0)!.flatbushItems[0]!
  const rLabel = rev.get(0)!.flatbushItems[1]!
  expect(rLeft.topPx).not.toBe(rLabel.topPx)
})

// A subfeature label (a transcript name under its gene) draws whenever the
// worker baked one — it is not gated by showLabels/showDescriptions, which only
// govern the feature's own name/description (see resolveFeatureLabels). So its
// overhang has to be reserved whenever it exists, independently of whether the
// parent kept a name line. Two cases where the parent keeps none:
//   - the gene carries no name of its own (nothing to gate on)
//   - names are switched off entirely — config `none`, or the fit ladder's
//     `bodies` rung, which packs with showLabels=false
// Left unreserved, the transcript label paints straight over whatever the packer
// put in the whitespace beside it.
describe('subfeature-label overhang is reserved even with no name line', () => {
  // Gene A (bp 0-10) carries only its transcript's label, 100px wide; gene B
  // sits in the whitespace that label overhangs (bp 20-30). At bpPerPx 1 the
  // reserved span is 0..106, so B has to stack.
  function data() {
    const base = makeFeatureData({
      features: [
        { featureId: 'geneA', startBp: 0, endBp: 10, height: 10 },
        { featureId: 'geneB', startBp: 20, endBp: 30, height: 10 },
      ],
    })
    const floatingLabelsData: FloatingLabelsDataMap = labelsMap({
      // keyed by the transcript, attributed to its gene — what emitSubfeatureLabel
      // writes
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

// Stable empty set: the model's pinnedFeatureIdSet is a MobX-cached getter with
// a stable reference, so the incremental memo relies on reference identity to
// detect a pin change. A fresh set per call would spuriously bust the cache.
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

  // same key (the fixture default) → same ref-group; a spanning feature could
  // shift rows, so the whole group must relay out (its references change).
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
  // A's 300px name label overhangs B at bpPerPx=2 (300 > 400/2) but not at
  // bpPerPx=1 (300 < 400/1), so zooming in frees row 0 under B. Through the
  // incremental memo (which once seeded from the prior layout) B must now rise
  // to row 0 rather than being held on its old lower row.
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

  // Same params but a new pinned set including B → group re-packs (output object
  // is not reused) and B takes the top row.
  const after = memo(
    new Map([[0, mk()]]),
    incInputs(1, new Set<number>(), new Set(['B'])),
  )
  expect(after.get(0)).not.toBe(beforeOut)
  expect(topOf(after, 'B')).toBe(0)
})

test('a collapsed pile does not outrank an arriving gene for the top row', () => {
  // The memo seeds each re-pack with the previous layout's rows so features near
  // the top keep them. A collapsed mark never competed for a row — it skips the
  // stacker — so its y=0 must not enter that seed: here a wide gene arrives over
  // a pile that had collapsed, which stops the pile collapsing (its marks now
  // overlap a visible feature) and sends every mark through the packer. Seeded
  // with their y=0 they are inserted first and take row 0, leaving the gene
  // stacked under features a thousandth its width.
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

  // zoomed out, nothing else on screen: the pile collapses to row 0
  const before = memo(
    new Map([[0, makeFeatureData({ features: marks })]]),
    incInputs(20),
  )
  expect(topOf(before, 'snp0')).toBe(0)

  // the gene's fetch lands
  const after = memo(
    new Map([[0, makeFeatureData({ features: [gene, ...marks] })]]),
    incInputs(20),
  )
  expect(topOf(after, 'gene')).toBe(0)
  expect(topOf(after, 'snp0')).toBeGreaterThan(0)
})

// 25 1bp variants inside 25bp at 20 bp/px: each paints the 2px minimum, so they
// all cover one point and the pile is DENSITY_COLLAPSE_DEPTH deep. The packer
// reserves what it paints, so left alone they claim 25 separate rows.
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
  // sub-pixel (0.05px < the 2px clamp) + fade → the whole pile shares row 0
  expect(pileRows(1, true).every(t => t === 0)).toBe(true)
  // same geometry, not a fade box (e.g. gene subfeature rects) → still stacks
  expect(Math.max(...pileRows(1, false))).toBeGreaterThan(0)
  // fade box but wide (5px > clamp) → a real box, stacks normally
  expect(Math.max(...pileRows(100, true))).toBeGreaterThan(0)
})

test('a pile one short of the bar keeps its rows', () => {
  // The bar is a track height, so it has to bite from below too: 24 of the same
  // marks stack, and every allele stays on its own row and stays hoverable.
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
  // Sub-pixel is not on its own a reason to give up a row. Two abutting SNVs
  // overlap once each is clamped to 2px, and pinning both to row 0 for that drew
  // the second on top of the first with no cue it was there — a track reading as
  // one row with a couple of variants loaded. A pair is not a pile: both stack,
  // both render, both opaque.
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
  // A collapsed mark is pinned to row 0 without an `addRect` of its own, so the
  // greedy stacker reads that row as clear. `edge` overlaps the pile's tail and
  // covers no point deep enough to collapse itself: handed row 0 it would paint
  // into the pile. The pile's span is booked out of the row, so it stacks above.
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
  // The collapse is per mark, not per connected run. A run chains through every
  // mark that lands inside a neighbour's clamped box, so at 1.5px spacing one
  // 25-deep hotspot reaches the whole view — and collapsing all of it put 600
  // SNVs the density gate admits onto one row, overlapping pairwise, too shallow
  // to fade. Exactly the defect the min-width reservation exists to stop.
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
  // What a fixed-height band asks for: every record shares row 0 the way
  // `displayMode: 'collapsed'` packs, but the labels the mode suppresses stay on.
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
  // and without it the same marks claim rows
  const stacked = layout(new Map([[0, data]]), 20).get(0)!
  expect(
    new Set(stacked.flatbushItems.map(it => it.topPx)).size,
  ).toBeGreaterThan(1)
})

test('two piles whose painted spans merely touch stay two piles', () => {
  // Ends sort before starts at equal px, so half-open spans that abut share no
  // point. Two 13-deep piles exactly one clamped box apart must not read as one
  // 26-deep pile and collapse.
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
  // Two disjoint runs in one layout, so the sweep has to reset both what it has
  // accumulated and how deep it got when a run closes. The sweep visits them in
  // COORDINATE order, so the pair has to sit once before the pile and once after:
  // a leaked run array strands the pair that opened first, a leaked depth strands
  // the one that opens second, and each order sees only its own.
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
  // Two miRNA-sized genes (sub-pixel at whole-arm zoom) sitting at nearly the
  // same spot. Both are density-fade Box glyphs, so the collapse path would pin
  // them to row 0 — but each still renders a floating name at its left edge, so
  // collapsing paints the two names on top of each other (the observed genes
  // track collision). With labels shown they must stack so the reserved label
  // width keeps the names apart.
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
  // showLabels off: no label to protect, so the sub-pixel boxes still collapse
  const noLabels = layout(new Map([[0, data]]), 26, false)
  const topNo = (id: string) =>
    noLabels.get(0)!.flatbushItems.find(f => f.featureId === id)!.topPx
  expect(topNo('mir1')).toBe(0)
  expect(topNo('mir2')).toBe(0)

  // showLabels on: labels are ~60px wide (~1560bp at bpPerPx=26) and overlap, so
  // the two features must land on different rows
  const withLabels = layout(new Map([[0, data]]), 26, true)
  const topYes = (id: string) =>
    withLabels.get(0)!.flatbushItems.find(f => f.featureId === id)!.topPx
  expect(topYes('mir1')).toBe(0)
  expect(topYes('mir2')).toBeGreaterThan(0)
})

test('a compact mode reserves label overhang at its own smaller font size', () => {
  // Two labeled genes placed so their reserved name overhangs collide at the
  // normal label size but not at superCompact's (×0.7). Widths are baked at
  // LABEL_FONT_SIZE in the worker, so reserving the raw width in every mode held
  // 43% more room than superCompact's text needs and pushed the second gene onto
  // a second row, thinning rows in the mode chosen for density.
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

  // 60px + padding of overhang at 11px reaches past g2's left edge -> stack
  expect(topIn('normal', 'g2')).toBeGreaterThan(0)
  // the same name draws 30% narrower at 7.7px, clearing g2 -> both share row 0
  expect(topIn('superCompact', 'g1')).toBe(0)
  expect(topIn('superCompact', 'g2')).toBe(0)
})

test('an unlabeled sub-pixel box does not collapse onto a labeled one', () => {
  // A partially-rs-ID'd VCF at sub-pixel zoom: the named variant is held out of
  // the collapse (its name must not pile onto row 0), so it takes a real row,
  // and the unnamed one at the same locus therefore has to see it and stack too.
  // Counting only wide features as "solid" left the labeled sub-pixel feature
  // invisible to the overlap guard, so the unnamed mark pinned to row 0 and its
  // min-width-clamped render landed on top of it.
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
  // A 1bp SNP sitting inside a wide gene box: both are density-fade boxes, but
  // only the SNP is sub-pixel. Pinning it to row 0 would draw it on top of the
  // wide gene (also at row 0), so it must stack instead. Regression for the
  // observed genes-track collision.
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
  // A VCF insertion is zero-length (it sits BETWEEN two bases), and the
  // renderers center its min-width mark on the coordinate rather than growing it
  // rightward — rect.slang's rectSpanPx `isPoint` branch. So at bpPerPx=1 an
  // insertion at 100 paints [99,101] and overlaps a gene ending at 100, even
  // though a same-width real span starting there ([100,102]) would clear it.
  // Measuring it off the start edge let it collapse onto row 0 and paint a pixel
  // into the gene.
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

  // paints [99,101], overlapping the gene's [50,100] — must stack
  expect(top(insertionAt(100))).toBeGreaterThan(0)
  // paints [101,103], clear of it — free to collapse
  expect(top(insertionAt(102))).toBe(0)
})

test('collapsed marks with clear space around them render opaque, not faded', () => {
  // The fixture pre-seeds rectDensityFade to 1 to prove layout owns the value:
  // these five collapsed variants are 100px apart at bpPerPx=1, so no two share
  // a pixel and nothing is hidden. They must stay solid (visible individual
  // features), not read as a faint 30% smear.
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
  // Five variants within 5bp at 26 bp/px. The packer reserves the 2px each one
  // paints, so all five collide and all five get a row — nothing is drawn over,
  // so nothing needs fading to admit it is there. The old layout reserved the raw
  // 0.04px instead, put all five on row 0, and drew one mark for five features.
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
  // The decision is per mark, not per region: the pile shares row 0 and every
  // mark on it is drawn over, so it fades; `lone` sits far clear, keeps a row to
  // itself and stays solid. A region-wide verdict (the old count) could only ever
  // answer this one way for all of them.
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
  // The min-width clamp widens every sub-pixel mark to MIN_RECT_WIDTH_PX, so two
  // annotations that merely ABUT — disjoint in bp, one starting where the other
  // ends — always overlap once painted. Fading on that pair is what inverted the
  // repeat lane in website/scripts/specs/graph.ts: a lane read for how much of
  // the interval is covered drew its denser clusters LIGHTER than their isolated
  // neighbours, because two marks at MIN_DENSITY_ALPHA accumulate to 0.51 where
  // one lone mark draws 1.0. Below PILEUP_FADE_DEPTH nothing fades and the
  // coverage read holds.
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
  // Painted spans are half-open, so the sweep must sort ends before starts at
  // equal px. These three 1bp marks are 1px apart and each paints 2px, so `left`
  // ends at exactly the px `right` starts: two marks cover every point, three
  // cover none. Sorting the tie the other way counts that touch and reports a
  // depth of three, fading a run that is merely evenly spaced — the shape of any
  // tiled annotation, which is the coverage read at its purest.
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
  // A dense SNP track: thousands of sub-pixel variants collapse onto row 0, and
  // in that regime every one fades so the pileup conveys density (accumulated
  // src-alpha) instead of a saturated flat block.
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
  // The collapse test compares a mark's PAINTED extent — its box widened to the
  // renderers' min-draw clamp — against its neighbours', so the clamp layout
  // assumes must be the one the renderers apply: MIN_RECT_WIDTH_PX (2px), per
  // rect.slang's extendToMinWidthX and Canvas2D's Math.max. Measuring it as 2x
  // that made a mark sitting 3px clear of a solid box read as overlapping it, so
  // it was held out of the collapse and drew opaque in the middle of a pileup.
  //
  // bpPerPx=1, so bp are px. `probe` is a 1bp mark ending 3px short of the wide
  // gene: inside a 4px clamp, clear of a 2px one. Read off topPx rather than the
  // fade flag — the marks here are 10px apart, so none of them pile up and none
  // of them fade; collapsing and fading are different questions.
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
      // wide (1000px), so it holds a real row and lands in the solid spans the
      // collapse test queries
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
  // the probe clears the gene by 2px, so it collapses like the rest
  expect(items[N]!.topPx).toBe(0)
  // the solid box holds a real row rather than collapsing (it is at row 0 too,
  // which is exactly why a mark overlapping it may not pin there)
  expect(items[N + 1]!.topPx).toBe(0)
  expect([...out.get(0)!.rectDensityFade].every(v => v === 0)).toBe(true)
})

test('thousands of sub-pixel variants collapse onto one row, not thousands', () => {
  // A dense variant track (dbSNP/gnomAD at whole-chromosome zoom): every variant
  // is a 1bp densityFade Box glyph, far narrower than the 2px clamp. Without the
  // collapse, first-fit under pixel-precise pitchX:1 packing would stack them
  // into thousands of rows (overflowing maxHeight into OFFSCREEN_Y); collapsing
  // pins them all to row 0 so the pileup renders as one density-textured row.
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
  // bpPerPx=100: each 1bp variant is 0.01px, and neighbors are 0.03px apart, so
  // every mark is deeply sub-pixel and heavily overlaps its neighbors once the
  // renderer widens it to the 2px min-width clamp.
  const out = layout(new Map([[0, data]]), 100, false)
  const items = out.get(0)!.flatbushItems
  expect(items).toHaveLength(N)
  expect(items.every(it => it.topPx === 0)).toBe(true)
  // total content height is a single feature's row, not N stacked rows
  expect(maxBottom(out)).toBe(items[0]!.bottomPx)
})

test('compact mode scales aminoAcidOverlay height alongside its top', () => {
  // The codon rect height is scaled via rectHeights in compact mode; the
  // overlay item that annotates it (font size + vertical centering + hit box)
  // must scale in lockstep so letters stay sized to and centered on the row.
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
  // compact multiplier is 0.6; topPx and heightPx must scale by the same factor
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
  // no labels so the row height is just body + padding, keeping the math simple
  const laid = layout(new Map([[0, data]]), 1, false, false)
  const before = maxBottom(laid)
  const scaled = scaleLaidOutData(laid, 0.5)

  // fresh clone, base map untouched
  expect(scaled.get(0)).not.toBe(laid.get(0))
  expect(maxBottom(laid)).toBe(before)

  // content height halved, and the packed flatbush box tops/bottoms too
  expect(maxBottom(scaled)).toBeCloseTo(before / 2)
  const base = laid.get(0)!.flatbushItems
  const out = scaled.get(0)!.flatbushItems
  for (let i = 0; i < base.length; i++) {
    expect(out[i]!.topPx).toBeCloseTo(base[i]!.topPx * 0.5)
    expect(out[i]!.bottomPx).toBeCloseTo(base[i]!.bottomPx * 0.5)
    expect(out[i]!.featureHeightPx).toBeCloseTo(base[i]!.featureHeightPx * 0.5)
  }
  // the row-offset rect Ys scale as well
  expect(out[0]).toBeDefined()
  const baseRectYs = laid.get(0)!.rectYs
  const outRectYs = scaled.get(0)!.rectYs
  for (let i = 0; i < baseRectYs.length; i++) {
    expect(outRectYs[i]).toBeCloseTo(baseRectYs[i]! * 0.5)
  }
})

// packedContentHeight exists so the fit solve can measure ~9 candidate factors
// without paying for a clone each time (the clone is ~4/5 of a layout). That is
// only sound while it reports EXACTLY what the committed layout reports — it packs
// the raw region data, applying the compact multiplier itself rather than reading
// an already-scaled clone, so the two can only agree if that arithmetic matches.
describe('packedContentHeight matches the committed layout', () => {
  // Mutually overlapping, so each needs its own row and the stack has real height.
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

  // Guards the packer against reading heights off the clone again: every feature
  // must land on its own row, with its row offset carried into rectYs, and a
  // compact stack must be genuinely shorter than a normal one.
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
    // row offsets reached the geometry, not left at the worker's 0
    expect(new Set(laid.rectYs).size).toBe(3)

    const compactH = packedContentHeight(new Map([[0, overlapping(3, 20)]]), {
      ...base,
      displayMode: 'compact',
    })
    expect(compactH).toBeLessThan(maxBottom(new Map([[0, laid]])))
  })
})

// The set fit mode measures its candidate stacks over. Extracted from the
// model's `fitMeasureFeatureIds` so the half-open rule — the one thing here that
// can be off by one, asked per feature per block — is checked directly instead of
// only through a fitted display.
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
          // ends exactly where the block starts: draws nothing inside it
          ['before', 50, 100],
          ['overlapsStart', 90, 110],
          ['inside', 120, 130],
          ['overlapsEnd', 190, 210],
          // starts exactly where the block ends
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
    // a region with no block on its ref contributes nothing, and one ref covered
    // by two blocks takes features from either
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
    // same refName under a different assembly is a different ref-group
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
