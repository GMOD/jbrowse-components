import {
  canMorph,
  captureDisplayedTops,
  captureFeatureTops,
  easeInOutCubic,
  interpolateYData,
} from './yMorph.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

// One rect per feature, sitting at the feature's top.
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
  // feature "a" was at 60, now lays out at 0
  const fromTops = new Map([['a', 60]])
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])

  expect(interpolateYData(fromTops, target, 0).get(0)!.rectYs[0]).toBe(60)
  expect(interpolateYData(fromTops, target, 0.5).get(0)!.rectYs[0]).toBe(30)
  expect(interpolateYData(fromTops, target, 1).get(0)!.rectYs[0]).toBe(0)
})

test('survives a re-fetch: matching is by id, not array index', () => {
  // old layout had [a@0, b@30]; new fetch returns [b@0, c@30, a@60] (different
  // order and length) — b and a still animate from their old rows.
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
  // b: old 30 -> new 0, a: old 0 -> new 60, c: new (no old) stays
  expect([...start.rectYs]).toEqual([30, 30, 0])
})

test('non-Y fields and hit-test extents come from target', () => {
  const fromTops = new Map([['a', 60]])
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  target.get(0)!.rectColors = new Uint32Array([0xdeadbeef])
  const mid = interpolateYData(fromTops, target, 0.5).get(0)!
  expect([...mid.rectColors]).toEqual([0xdeadbeef])
  // hit-test extent stays at the destination
  expect(mid.flatbushItems[0]!.topPx).toBe(0)
})

test('floating label tops follow their feature', () => {
  const fromTops = new Map([['a', 100]])
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  target.get(0)!.floatingLabelsData = {
    a: {
      featureId: 'a',
      minX: 0,
      maxX: 10,
      topY: 0,
      featureHeight: 10,
      nameLabel: { text: 'a', relativeY: 0, color: 'black', textWidth: 20 },
    },
  }
  const mid = interpolateYData(fromTops, target, 0.5).get(0)!
  expect(mid.floatingLabelsData.a!.topY).toBe(50)
})

test('canMorph needs at least one shared feature and a bounded rect count', () => {
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  expect(canMorph(new Map([['a', 5]]), target)).toBe(true)
  expect(canMorph(new Map([['z', 5]]), target)).toBe(false)
})

test('canMorph is false when a shared feature did not move', () => {
  // stable seeding kept "a" on the same row across the repack — nothing to ease
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  expect(canMorph(new Map([['a', 0]]), target)).toBe(false)
})

test('captureFeatureTops skips features overflowed off-screen', () => {
  // "a" overflowed maxHeight in the prior layout (OFFSCREEN_Y ~ -1e6); it must
  // not become a morph source, else it flies in from ~-1e6 when it reappears.
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

test('captureDisplayedTops eases each feature from source toward target', () => {
  // "a" is morphing from row 60 (source) to row 0 (target). Halfway through, its
  // displayed top is 30 — that's what re-seeds a morph interrupted mid-flight.
  const target = new Map([[0, region([{ featureId: 'a', top: 0 }])]])
  const fromTops = new Map([['a', 60]])
  expect(captureDisplayedTops(target, fromTops, 0).get('a')).toBe(60)
  expect(captureDisplayedTops(target, fromTops, 0.5).get('a')).toBe(30)
  expect(captureDisplayedTops(target, fromTops, 1).get('a')).toBe(0)
})

test('captureDisplayedTops leaves features with no source at the target', () => {
  const target = new Map([[0, region([{ featureId: 'a', top: 40 }])]])
  expect(captureDisplayedTops(target, new Map(), 0.5).get('a')).toBe(40)
})

test('a feature overflowing off-screen in the target does not animate', () => {
  // "a" was on-screen at 50, now overflows off-screen at ~-1e6: it must stay at
  // its destination, not sweep from 50 down to -1e6 over the morph.
  const fromTops = new Map([['a', 50]])
  const target = new Map([[0, region([{ featureId: 'a', top: -1e6 }])]])
  expect(canMorph(fromTops, target)).toBe(false)
  expect(interpolateYData(fromTops, target, 0).get(0)!.rectYs[0]).toBe(-1e6)
})
