import { PileupLayout } from '@jbrowse/core/util/layouts'

import { layoutFeature } from './layoutFeature.ts'

import type { Feature } from '@jbrowse/core/util'
import type { Mismatch } from '../shared/types.ts'

function makeFeature(
  start: number,
  end: number,
  mismatches: Mismatch[],
): Feature {
  return {
    id: () => 'r1',
    get(name: string) {
      if (name === 'start') {
        return start
      }
      if (name === 'end') {
        return end
      }
      if (name === 'mismatches') {
        return mismatches
      }
      return undefined
    },
  } as Feature
}

test('soft clip layout expansion is capped by maxClippingSize', () => {
  const layout = new PileupLayout({
    featureHeight: 7,
    spacing: 0,
    maxHeight: 1200,
  })
  const feature = makeFeature(100_000, 100_100, [
    { type: 'softclip', start: 0, cliplen: 50_000 },
    { type: 'softclip', start: 99, cliplen: 40_000 },
  ])

  layoutFeature({
    feature,
    layout,
    showSoftClip: true,
    heightPx: 7,
    displayMode: 'normal',
    maxClippingSize: 10_000,
  })

  const tuple = layout.getRectangles().get('r1')
  expect(tuple).toBeDefined()
  const [left, , right] = tuple!
  expect(left).toBe(90_000)
  expect(right).toBe(110_100)
})

test('soft clip sums per side then applies cap', () => {
  const layout = new PileupLayout({
    featureHeight: 7,
    spacing: 0,
    maxHeight: 1200,
  })
  const feature = makeFeature(1000, 1100, [
    { type: 'softclip', start: 0, cliplen: 3000 },
    { type: 'softclip', start: 0, cliplen: 4000 },
  ])

  layoutFeature({
    feature,
    layout,
    showSoftClip: true,
    heightPx: 7,
    displayMode: 'normal',
    maxClippingSize: 5000,
  })

  const tuple = layout.getRectangles().get('r1')
  expect(tuple).toBeDefined()
  const [left, , right] = tuple!
  expect(left).toBe(-4000)
  expect(right).toBe(1100)
})
