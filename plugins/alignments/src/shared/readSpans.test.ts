import { makeEmptyPileupData } from '../LinearAlignmentsDisplay/testUtils.ts'
import { medianReadSpan } from './readSpans.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

function lane(...spans: [number, number][]): WorkerPileupData {
  return {
    ...makeEmptyPileupData(),
    readPositions: Uint32Array.from(spans.flat()),
  }
}

test('an unloaded window measures 0 rather than NaN', () => {
  // `median` of an empty sample averages two undefineds; the guard is what
  // keeps a `force load` window out of the dialog's short-read sentence.
  expect(medianReadSpan([])).toBe(0)
  expect(medianReadSpan([new Map([[0, lane()]])])).toBe(0)
})

test('an even sample averages the middle pair, as the insert-size median does', () => {
  expect(
    medianReadSpan([
      new Map([[0, lane([0, 100], [1000, 1300], [5000, 5500], [9000, 9700])]]),
    ]),
  ).toBe(400)
})

test('every lane and every region counts once', () => {
  // The lanes are `rawDataByGroup.values()` — one per group key, each keyed by
  // displayed region — so a grouped pileup must not measure only its first
  // group, which is how a haplotagged track would report one haplotype's reads.
  expect(
    medianReadSpan([
      new Map([
        [0, lane([0, 100])],
        [1, lane([2000, 2100])],
      ]),
      new Map([[0, lane([50, 50_050], [60_000, 110_000])]]),
    ]),
  ).toBe(25_050)
})
