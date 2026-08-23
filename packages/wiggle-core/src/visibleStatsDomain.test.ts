import { visibleStatsDomain } from './visibleStatsDomain.ts'

import type { SettledBlocksView } from './visibleStatsDomain.ts'

const block = (displayedRegionIndex: number, start: number, end: number) => ({
  displayedRegionIndex,
  start,
  end,
})

const viewWith = (
  blocks: SettledBlocksView['settledDynamicBlocks'],
  initialized = true,
) => ({ initialized, settledDynamicBlocks: blocks })

// One payload per region: the scores of the features at [pos, pos+1).
const scores = new Map([
  [0, [3, 9, 5]],
  [1, [20]],
])

function domainOver(view: SettledBlocksView, active = true) {
  return visibleStatsDomain({
    active,
    view,
    payloadFor: index => scores.get(index),
    itemsFor: regionScores => regionScores,
    accumulate: entries =>
      entries.length
        ? {
            scoreMin: Math.min(...entries.map(e => e.data)),
            scoreMax: Math.max(...entries.map(e => e.data)),
          }
        : undefined,
    range: ({ scoreMin, scoreMax }) => [scoreMin, scoreMax],
    bounds: [undefined, undefined],
    scaleType: 'linear',
  })
}

test('nice-rounds the accumulated range across the settled blocks', () => {
  expect(domainOver(viewWith([block(0, 0, 3), block(1, 0, 1)]))).toEqual([
    0, 20,
  ])
})

// The empty-versus-stale rule, and why the walk reads `settledDynamicBlocks`
// rather than `coarseDynamicBlocks`: `undefined` says "nothing to scale
// against yet", and every caller falls that back to `[0, 1]`. Answering `[0,1]`
// over an empty coarse block list while the data was already loaded is what
// drew a bigwig line track blank and a density track solid — the block list is
// empty for one debounce window, not the data.
test('is undefined, not [0, 1], while there is nothing to scale against', () => {
  expect(domainOver(viewWith([], true))).toBeUndefined()
  expect(domainOver(viewWith([block(0, 0, 3)], false))).toBeUndefined()
  expect(domainOver(viewWith([block(7, 0, 3)]))).toBeUndefined()
  expect(domainOver(viewWith([block(0, 0, 3)]), false)).toBeUndefined()
})

test('walks only the blocks on screen, so an offscreen region is out', () => {
  expect(domainOver(viewWith([block(0, 0, 3)]))).toEqual([0, 9])
})

test('clips each block to whole bp before the accumulator sees it', () => {
  const spans: [number, number][] = []
  visibleStatsDomain({
    active: true,
    view: viewWith([{ displayedRegionIndex: 0, start: 10.7, end: 20.2 }]),
    payloadFor: () => [1],
    itemsFor: items => items,
    accumulate: entries => {
      for (const { visStart, visEnd } of entries) {
        spans.push([visStart, visEnd])
      }
      return { scoreMin: 0, scoreMax: 1 }
    },
    range: ({ scoreMin, scoreMax }) => [scoreMin, scoreMax],
    bounds: [undefined, undefined],
    scaleType: 'linear',
  })
  expect(spans).toEqual([[10, 21]])
})

test('a configured bound wins over the autoscaled end', () => {
  expect(
    visibleStatsDomain({
      active: true,
      view: viewWith([block(0, 0, 3)]),
      payloadFor: index => scores.get(index),
      itemsFor: regionScores => regionScores,
      accumulate: () => ({ scoreMin: 3, scoreMax: 9 }),
      range: ({ scoreMin, scoreMax }) => [scoreMin, scoreMax],
      bounds: [undefined, 100],
      scaleType: 'linear',
    }),
  ).toEqual([0, 100])
})
