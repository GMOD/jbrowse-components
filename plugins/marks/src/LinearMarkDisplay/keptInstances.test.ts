import { hitIndexOf, withHitIndex } from '@jbrowse/core/util/markEncoding'

import { keptInstances } from './keptInstances.ts'

import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'

function layer(): EncodedChannels {
  const y = Float32Array.from([5, 9, 1, 7])
  return {
    count: 4,
    skipped: 0,
    x: Uint32Array.from([0, 10, 20, 30]),
    x2: Uint32Array.from([5, 15, 25, 35]),
    y,
    yMin: 1,
    yMax: 9,
    colorValue: y,
    row: Uint32Array.from([0, 1, 0, 1]),
    text: ['a', 'b', 'c', 'd'],
    color: Uint32Array.from([1, 2, 3, 4]),
    root: Uint32Array.from([7, 7, 8, 8]),
  }
}

test('every lane keeps the same instances, and featureIndex still names their features', () => {
  const kept = keptInstances(layer(), Uint8Array.from([1, 0, 1, 0]))
  expect(kept.count).toBe(2)
  expect([...kept.x]).toEqual([0, 20])
  expect([...kept.x2]).toEqual([5, 25])
  expect([...kept.y!]).toEqual([5, 1])
  expect([...kept.row!]).toEqual([0, 0])
  expect(kept.text).toEqual(['a', 'c'])
  expect([...(kept.color as Uint32Array)]).toEqual([1, 3])
  expect([...kept.featureIndex!]).toEqual([0, 2])
  expect([...kept.root!]).toEqual([7, 8])
  expect([kept.yMin, kept.yMax]).toEqual([1, 5])
  // a color over the plotted field stays the y lane itself
  expect(kept.colorValue).toBe(kept.y)
})

test('a featureIndex the worker wrote maps through to the original features', () => {
  const kept = keptInstances(
    { ...layer(), featureIndex: Uint32Array.from([3, 4, 8, 9]) },
    Uint8Array.from([0, 1, 0, 1]),
  )
  expect([...kept.featureIndex]).toEqual([4, 9])
})

test('a hit index is rebuilt over the kept instances', () => {
  const whole = layer()
  const indexed = withHitIndex({
    ...whole,
    flatbushData: hitIndexOf(whole.x, whole.x2, whole.y).data,
  })
  const kept = keptInstances(indexed, Uint8Array.from([0, 0, 1, 1]))
  expect(kept.flatbush?.numItems).toBe(2)
  expect(kept.flatbush?.search(19, 0, 26, 10)).toEqual([0])
})

test('keeping every instance hands the layer back', () => {
  const all = layer()
  expect(keptInstances(all, Uint8Array.from([1, 1, 1, 1]))).toBe(all)
})
