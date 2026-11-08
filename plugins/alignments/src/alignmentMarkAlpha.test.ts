import { insertionSizeAlpha } from '../../../packages/alignments-core/src/insertionSizeAlpha.generated.ts'
import { insertionBarWidthPx } from '../../../packages/alignments-core/src/insertionWidth.generated.ts'
import {
  LABEL_FADE_FLOOR,
  labelFadeOpacity,
  labelFont,
} from '../../../packages/alignments-core/src/labelConstants.ts'
import { DEFAULT_QUALITY_FADE } from './features/mismatch/qualityOpacity.ts'
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
    mismatchOpacity: 'baseQuality',
    deletions: { length: [2, 30], fade: [0.5, 0] },
    mismatches: { fade: [0, 1], quality: [10, 255] },
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
  const { zero, slope, min, max } = DEFAULT_QUALITY_FADE
  expect(t.mismatches.alpha).toEqual([
    qualityFade(10, zero, slope, min, max) * frequencyFadeGate(0.1, 0, true),
    qualityFade(255, zero, slope, min, max) * frequencyFadeGate(0.1, 1, true),
  ])
  expect(t.mismatches.alpha[0]).toBeCloseTo(0.04, 10)
  expect(t.clips.alpha).toEqual([
    frequencyFadeGate(0.1, 0, true),
    frequencyFadeGate(0.1, 0.5, true),
  ])
})

test('a written opacity scale fades a mismatch along its own domain and range', () => {
  const { mismatches } = alignmentMarkAlpha({
    pxPerBp: 2,
    mismatchOpacity: {
      field: 'baseQuality',
      scale: { domainMin: 10, domainMax: 30, range: [0.2, 1] },
    },
    mismatches: { fade: [1, 1, 1], quality: [0, 20, 40] },
  })
  expect(mismatches.alpha[0]).toBeCloseTo(0.2, 10)
  expect(mismatches.alpha[1]).toBeCloseTo(0.6, 10)
  expect(mismatches.alpha[2]).toBe(1)
})

test('a constant opacity draws a mismatch at it, one with no quality opaque', () => {
  const opaque = alignmentMarkAlpha({
    pxPerBp: 2,
    mismatchOpacity: 1,
    mismatches: { fade: [1, 1] },
  })
  expect(opaque.mismatches.alpha).toEqual([1, 1])
  const half = alignmentMarkAlpha({
    pxPerBp: 2,
    mismatchOpacity: { value: 0.5 },
    mismatches: { fade: [1, 1], quality: [30, 255] },
  })
  expect(half.mismatches.alpha).toEqual([0.5, 1])
})

test('an undeclared opacity member is refused', () => {
  expect(() =>
    alignmentMarkAlpha({
      pxPerBp: 1,
      mismatchOpacity: { alpha: 0.5 } as never,
    }),
  ).toThrow()
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
  expect(t.mismatches.alpha[0]).toBeCloseTo(0.4, 10)
  expect(t.clips.alpha).toEqual([1])
})

test('a column may be one number, and a setting left out takes the pileup default', () => {
  const one = alignmentMarkAlpha({
    pxPerBp: 0.5,
    insertions: { length: 3, fade: 0.2 },
    deletions: { length: 2, fade: 0 },
    mismatches: { fade: 0.5, quality: 255 },
    clips: { fade: 0 },
  })
  const many = alignmentMarkAlpha({
    pxPerBp: 0.5,
    featureHeight: 7,
    fadeLowFrequency: true,
    mismatchOpacity: { field: undefined },
    insertions: { length: [3], fade: [0.2] },
    deletions: { length: [2], fade: [0] },
    mismatches: { fade: [0.5], quality: [255] },
    clips: { fade: [0] },
  })
  expect(one).toEqual(many)
  expect(one.clips.alpha[0]).toBe(0.5)
})

test('a missing column, columns of two lengths and a bad pxPerBp are refused', () => {
  const call =
    (args: Partial<Parameters<typeof alignmentMarkAlpha>[0]>) => () =>
      alignmentMarkAlpha({ pxPerBp: 1, ...args })
  expect(call({ mismatches: { quality: [30] } as never })).toThrow(
    'mismatches.fade is missing',
  )
  expect(
    call({ mismatchOpacity: 'baseQuality', mismatches: { fade: [0.5] } }),
  ).toThrow('mismatches.quality is missing')
  expect(call({ insertions: { length: [1, 2], fade: [0] } })).toThrow(
    'insertions.fade has 1 rows where insertions.length has 2',
  )
  expect(call({ clips: { fade: 'x' as never } })).toThrow(
    'clips.fade is a number or an array of numbers',
  )
  for (const pxPerBp of [-1, Number.NaN, Infinity]) {
    expect(call({ pxPerBp })).toThrow(`pxPerBp is ${pxPerBp}`)
  }
  expect(call({ pxPerBp: 0 })).not.toThrow()
})

test('a deletion’s length label fades by the px of it inside its region against its digits, and shows on no read too short for text', () => {
  const digitsPx = labelFont(10).measure('12')
  const t = alignmentMarkAlpha({
    pxPerBp: 1,
    featureHeight: 10,
    deletions: {
      length: [12, 12, 12, 12],
      fade: [0, 0, 0, 0],
      visibleLength: [digitsPx * 2, digitsPx, digitsPx * 1.5, 1],
    },
  })
  expect(t.deletions.labelAlpha).toEqual(
    [digitsPx * 2, digitsPx, digitsPx * 1.5, 1].map(bp =>
      labelFadeOpacity(bp, digitsPx),
    ),
  )
  expect(t.deletions.labelAlpha[0]).toBe(1)
  expect(t.deletions.labelAlpha[1]).toBe(0)
  expect(t.deletions.labelAlpha[2]).toBeGreaterThan(LABEL_FADE_FLOOR)
  expect(t.deletions.labelAlpha[3]).toBe(0)
  const whole = alignmentMarkAlpha({
    pxPerBp: 2,
    featureHeight: 10,
    deletions: { length: [30], fade: [0] },
  })
  expect(whole.deletions.labelAlpha).toEqual([
    labelFadeOpacity(60, labelFont(10).measure('30')),
  ])
  const short = alignmentMarkAlpha({
    pxPerBp: 2,
    featureHeight: 3,
    deletions: { length: [30], fade: [0] },
  })
  expect(short.deletions.labelAlpha).toEqual([0])
})

test('a mismatch’s letter takes its quality fade alone, and none under the letter floor', () => {
  const { mismatches } = alignmentMarkAlpha({
    pxPerBp: 0.1,
    fadeLowFrequency: true,
    mismatchOpacity: {
      field: 'baseQuality',
      scale: { domainMin: 0, domainMax: 50, range: [0, 1] },
    },
    mismatches: { fade: [1, 1, 1, 0], quality: [1, 3, 10, 255] },
  })
  expect(mismatches.letterAlpha[0]).toBe(0)
  expect(mismatches.letterAlpha[1]).toBeCloseTo(0.06, 10)
  expect(mismatches.letterAlpha[2]).toBeCloseTo(0.2, 10)
  expect(mismatches.letterAlpha[3]).toBe(1)
  expect(mismatches.alpha[3]).toBeLessThan(1)
})
