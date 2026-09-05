import {
  labelsMap,
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  canMorph,
  captureFeatureTops,
  easeInOutCubic,
  interpolateYData,
  morphOffset,
  rowGeometrySignature,
} from './yMorph.ts'

function region(features: { featureId: string; top: number }[]) {
  return makeFeatureData({
    flatbushItems: features.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'feature',
        topPx: f.top,
        bottomPx: f.top + 10,
      }),
    ),
    rectPositions: new Uint32Array(features.length * 2),
    rectYs: new Float32Array(features.map(f => f.top)),
    rectHeights: new Float32Array(features.map(() => 10)),
    rectColors: new Uint32Array(features.length),
    rectStrands: new Float32Array(features.length),
    rectDensityFade: new Uint32Array(features.length),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
  })
}

test('easeInOutCubic pins the endpoints and midpoint', () => {
  expect(easeInOutCubic(0)).toBe(0)
  expect(easeInOutCubic(1)).toBe(1)
  expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
})

test('captureFeatureTops records each feature row by id', () => {
  const tops = captureFeatureTops(
    new Map([
      [
        0,
        region([
          { featureId: 'a', top: 0 },
          { featureId: 'b', top: 30 },
        ]),
      ],
    ]),
  )
  expect(tops.get('a')).toBe(0)
  expect(tops.get('b')).toBe(30)
})

test('a feature eases from its old row to its new one', () => {
  const fromTops = new Map([['a', 60]])
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])

  expect(interpolateYData(fromTops, target, 0).get(0)!.rectYs[0]).toBe(60)
  expect(interpolateYData(fromTops, target, 0.5).get(0)!.rectYs[0]).toBe(30)
  expect(interpolateYData(fromTops, target, 1).get(0)!.rectYs[0]).toBe(0)
})

test('survives a re-fetch: matching is by id, not array index', () => {
  const fromTops = new Map([
    ['a', 0],
    ['b', 30],
  ])
  const target = new Map([
    [
      0,
      region([
        { featureId: 'b', top: 0 },
        { featureId: 'c', top: 30 },
        { featureId: 'a', top: 60 },
      ]),
    ],
  ])
  const start = interpolateYData(fromTops, target, 0).get(0)!
  expect([...start.rectYs]).toEqual([30, 30, 0])
})

test('non-Y fields and hit-test extents come from target', () => {
  const fromTops = new Map([['a', 60]])
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  target.get(0)!.rectColors = new Uint32Array([0xdeadbeef])
  const mid = interpolateYData(fromTops, target, 0.5).get(0)!
  expect([...mid.rectColors]).toEqual([0xdeadbeef])
  expect(mid.flatbushItems[0]!.topPx).toBe(0)
})

test('floating label tops follow their feature', () => {
  const fromTops = new Map([['a', 100]])
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  target.get(0)!.floatingLabelsData = labelsMap({
    a: {
      featureId: 'a',
      minX: 0,
      maxX: 10,
      topY: 0,
      featureHeight: 10,
      nameLabel: { text: 'a', relativeY: 0, textWidth: 20 },
    },
  })
  const mid = interpolateYData(fromTops, target, 0.5).get(0)!
  expect(mid.floatingLabelsData.get('a')!.topY).toBe(50)
})

test('canMorph needs at least one shared feature and a bounded rect count', () => {
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  expect(canMorph(new Map([['a', 5]]), target)).toBe(true)
  expect(canMorph(new Map([['z', 5]]), target)).toBe(false)
})

test('canMorph is false when a shared feature did not move', () => {
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  expect(canMorph(new Map([['a', 0]]), target)).toBe(false)
})

test('captureFeatureTops skips features overflowed off-screen', () => {
  const tops = captureFeatureTops(
    new Map([
      [
        0,
        region([
          { featureId: 'a', top: -1e6 },
          { featureId: 'b', top: 30 },
        ]),
      ],
    ]),
  )
  expect(tops.has('a')).toBe(false)
  expect(tops.get('b')).toBe(30)
})

test('captureFeatureTops with a morph in flight records displayed tops', () => {
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  const fromTops = new Map([['a', 60]])
  expect(captureFeatureTops(target, fromTops, 0).get('a')).toBe(60)
  expect(captureFeatureTops(target, fromTops, 0.5).get('a')).toBe(30)
  expect(captureFeatureTops(target, fromTops, 1).get('a')).toBe(0)
})

test('captureFeatureTops leaves features with no morph source at their row', () => {
  const target = new Map([[0, region([{ featureId: 'a', top: 40 }])]])
  expect(captureFeatureTops(target, new Map(), 0.5).get('a')).toBe(40)
})

test('morphOffset is the displacement interpolateYData applies', () => {
  const fromTops = new Map([['a', 60]])
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  for (const t of [0, 0.25, 0.5, 1]) {
    const rectY = interpolateYData(fromTops, target, t).get(0)!.rectYs[0]!
    expect(morphOffset(fromTops, 'a', 0, t)).toBe(rectY - 0)
  }
  expect(morphOffset(fromTops, 'unknown', 0, 0)).toBe(0)
  expect(morphOffset(fromTops, 'a', -1e6, 0)).toBe(0)
})

test('a feature overflowing off-screen in the target does not animate', () => {
  const fromTops = new Map([['a', 50]])
  const target = new Map([[0, region([{ featureId: 'a', top: -1e6 }])]])
  expect(canMorph(fromTops, target)).toBe(false)
  expect(interpolateYData(fromTops, target, 0).get(0)!.rectYs[0]).toBe(-1e6)
})

test('rowGeometrySignature separates two isoform counts', () => {
  const at = (maxIsoforms: number | undefined) =>
    rowGeometrySignature({
      displayMode: 'normal',
      renderedShowLabels: true,
      renderedShowDescriptions: false,
      fitScale: 1,
      fitLevel: 'isoforms',
      labelRoomFactor: undefined,
      maxIsoforms,
    })
  expect(at(5)).not.toBe(at(4))
  expect(at(5)).toBe(at(5))
  expect(at(undefined)).not.toBe(at(1))
})
