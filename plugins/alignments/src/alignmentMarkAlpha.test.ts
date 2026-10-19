import { insertionSizeAlpha } from '../../../packages/alignments-core/src/insertionSizeAlpha.generated.ts'
import { insertionBarWidthPx } from '../../../packages/alignments-core/src/insertionWidth.generated.ts'
import {
  frequencyFadeGate,
  sizeAlpha,
} from './shaders/slang/alignmentsUniforms.js.generated.ts'
import { qualityFade } from './shaders/slang/mismatch.js.generated.ts'
import { alignmentMarkAlpha } from './tables.ts'

test('an insertion takes the glyph’s width and fades by size, and by frequency under 10 bp', () => {
  const cases = [
    { pxPerBp: 0.5, featureHeight: 7, length: 3, fade: 0.2 },
    { pxPerBp: 1, featureHeight: 7, length: 40, fade: 0 },
    { pxPerBp: 1, featureHeight: 3, length: 40, fade: 0 },
    { pxPerBp: 0.001, featureHeight: 7, length: 9, fade: 0.6 },
    { pxPerBp: 0.001, featureHeight: 7, length: 2000, fade: 0 },
  ]
  for (const { pxPerBp, featureHeight, length, fade } of cases) {
    const { insertions } = alignmentMarkAlpha({
      pxPerBp,
      featureHeight,
      fadeLowFrequency: true,
      insertions: { length: [length], fade: [fade] },
    })
    expect(insertions.widthPx).toEqual([
      insertionBarWidthPx(length, pxPerBp, featureHeight),
    ])
    const frequency =
      length < 10 ? frequencyFadeGate(pxPerBp * pxPerBp, fade, true) : 1
    expect(insertions.alpha).toEqual([
      insertionSizeAlpha(length, pxPerBp) * frequency,
    ])
  }
  const [small, boxed, compact] = cases.map(
    ({ pxPerBp, featureHeight, length, fade }) =>
      alignmentMarkAlpha({
        pxPerBp,
        featureHeight,
        fadeLowFrequency: true,
        insertions: { length: [length], fade: [fade] },
      }).insertions,
  )
  expect(small!.widthPx[0]).toBe(1)
  expect(small!.alpha[0]).toBeCloseTo(0.4, 10)
  expect(boxed).toEqual({ widthPx: [22], alpha: [1] })
  expect(compact!.widthPx[0]).toBe(5)
})

test('a deletion fades by its width in px, a mismatch by quality and the zoom, a clip by the zoom', () => {
  const t = alignmentMarkAlpha({
    pxPerBp: 0.1,
    featureHeight: 7,
    fadeLowFrequency: true,
    fadeLowBaseQuality: true,
    deletions: { length: [2, 30], fade: [0.5, 0] },
    mismatches: { fade: [0, 1], quality: [25, 255] },
    clips: { fade: [0, 0.5] },
  })
  expect(t.deletions.alpha).toEqual(
    [
      [2, 0.5],
      [30, 0],
    ].map(([length, fade]) => {
      const widthPx = length! * 0.1
      return sizeAlpha(widthPx) * frequencyFadeGate(widthPx ** 2, fade!, true)
    }),
  )
  expect(t.deletions.alpha[0]).toBeCloseTo(0.2 * 0.52, 10)
  expect(t.deletions.alpha[1]).toBe(1)
  const under = alignmentMarkAlpha({
    pxPerBp: 0.001,
    featureHeight: 7,
    fadeLowFrequency: true,
    deletions: { length: [3], fade: [1] },
  })
  expect(under.deletions.alpha).toEqual([0])
  expect(t.mismatches.alpha).toEqual([
    qualityFade(25, true) * frequencyFadeGate(0.1, 0, true),
    qualityFade(255, true) * frequencyFadeGate(0.1, 1, true),
  ])
  expect(t.mismatches.alpha[0]).toBeCloseTo(0.05, 10)
  expect(t.clips.alpha).toEqual([
    frequencyFadeGate(0.1, 0, true),
    frequencyFadeGate(0.1, 0.5, true),
  ])
})

test('with fadeLowFrequency off only size and quality fade a mark', () => {
  const t = alignmentMarkAlpha({
    pxPerBp: 0.1,
    featureHeight: 7,
    fadeLowFrequency: false,
    insertions: { length: [3], fade: [0] },
    deletions: { length: [5], fade: [0] },
    mismatches: { fade: [0], quality: [10] },
    clips: { fade: [0] },
  })
  expect(t.insertions.alpha).toEqual([insertionSizeAlpha(3, 0.1)])
  expect(t.deletions.alpha).toEqual([sizeAlpha(0.5)])
  expect(t.mismatches.alpha).toEqual([1])
  expect(t.clips.alpha).toEqual([1])
})
