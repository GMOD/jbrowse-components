import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { countTruncatedFeatures } from './layoutQueries.ts'
import { OFFSCREEN_Y } from './rowPlacement.ts'

const unplaced = (featureId: string) =>
  makeFlatbushItem({ featureId, topPx: OFFSCREEN_Y, bottomPx: OFFSCREEN_Y })

// a feature spanning two displayed regions has an item in each, and the "N not
// shown" sentence counted it twice
test('a truncated feature spanning two regions counts once', () => {
  const map = new Map([
    [0, makeFeatureData({ flatbushItems: [unplaced('a'), unplaced('b')] })],
    [1, makeFeatureData({ flatbushItems: [unplaced('a')] })],
  ])
  expect(countTruncatedFeatures(map)).toBe(2)
})

test('only measured features count, and never an excluded one', () => {
  const map = new Map([
    [
      0,
      makeFeatureData({
        flatbushItems: [unplaced('a'), unplaced('b'), unplaced('c')],
      }),
    ],
  ])
  expect(countTruncatedFeatures(map, new Set(['a', 'b']), new Set(['b']))).toBe(
    1,
  )
})
