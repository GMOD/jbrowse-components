import { colorRampStops, sampleColorRamp } from '@jbrowse/core/util/colorRamp'

import {
  buildIdentityRuns,
  identityBars,
  identityRunColors,
  identityOver,
  identityRgb,
  identitySpans,
} from './identity.ts'

import type { MafBlock } from './mafRenderingBackendTypes.ts'

// test only
// eslint-disable-next-line  @typescript-eslint/no-misused-spread
const bytes = (s: string) => new Uint8Array([...s].map(c => c.charCodeAt(0)))

function block(
  startBp: number,
  refSeq: string,
  rows: [number, string][],
): MafBlock {
  const refLen = refSeq.replaceAll('-', '').length
  return {
    startBp,
    endBp: startBp + refLen,
    refSeqBytes: bytes(refSeq),
    rows: rows.map(([rowIndex, seq]) => ({
      rowIndex,
      alignmentBytes: bytes(seq),
    })),
    empties: [],
  }
}

function runs(blocks: MafBlock[], binBp = 1) {
  const r = buildIdentityRuns(blocks, binBp)
  return Array.from({ length: r.count }, (_, i) => [
    r.row[i],
    r.x[i],
    r.x2[i],
    r.step[i],
  ])
}

test('merges bases of one identity into a run, and splits at a mismatch', () => {
  expect(runs([block(100, 'ACGT', [[0, 'ACGA']])])).toEqual([
    [0, 100, 103, 100],
    [0, 103, 104, 0],
  ])
})

test('a sample gap is a hole, not a mismatch', () => {
  expect(runs([block(100, 'ACGT', [[0, 'A-GT']])])).toEqual([
    [0, 100, 101, 100],
    [0, 102, 104, 100],
  ])
})

test('a reference insertion column takes no reference position', () => {
  expect(runs([block(100, 'A-CG', [[0, 'ATCG']])])).toEqual([
    [0, 100, 103, 100],
  ])
})

test('a reference N is unclassifiable, to the runs and the hover alike', () => {
  const blocks = [block(100, 'NnA', [[0, 'CnA']])]
  expect(runs(blocks)).toEqual([[0, 102, 103, 100]])
  expect(identityOver(blocks, 0, 100, 103)).toEqual({ identity: 1, bases: 1 })
})

test('soft-masked bases compare by letter', () => {
  expect(runs([block(100, 'AC', [[0, 'ac']])])).toEqual([[0, 100, 102, 100]])
})

test('a row shorter than the reference is absent past its end', () => {
  expect(runs([block(100, 'ACGT', [[0, 'AC']])])).toEqual([[0, 100, 102, 100]])
})

test('a window averages every base in it, spanning the ones it classified', () => {
  // 4bp windows at absolute multiples of 4: [100,104) is 3/4 and [104,108) 1
  expect(runs([block(100, 'ACGTACGT', [[0, 'ATGTACGT']])], 4)).toEqual([
    [0, 100, 104, 75],
    [0, 104, 108, 100],
  ])
})

test('a window carries its mean across a block boundary', () => {
  expect(
    runs([block(100, 'AC', [[0, 'AT']]), block(102, 'GT', [[0, 'GT']])], 4),
  ).toEqual([[0, 100, 104, 75]])
})

test('runs of one row do not merge across an unaligned stretch', () => {
  expect(
    runs([block(100, 'AC', [[0, 'AC']]), block(200, 'GT', [[0, 'GT']])]),
  ).toEqual([
    [0, 100, 102, 100],
    [0, 200, 202, 100],
  ])
})

// in row order, so at sub-pixel rows the row painted last is the one the hover
// names, as the cells do
test('each row keeps its own windows, and the runs come in row order', () => {
  expect(
    runs(
      [
        block(100, 'ACGTACGTACGTACG', [
          [0, 'ACGTACGTACGTACG'],
          [1, 'ACGTAGGGGGGTACG'],
        ]),
      ],
      5,
    ),
  ).toEqual([
    [0, 100, 115, 100],
    [1, 100, 105, 100],
    [1, 105, 110, 20],
    [1, 110, 115, 100],
  ])
})

test('a reference position past 2^31 classifies', () => {
  expect(runs([block(2 ** 31 + 10, 'AC', [[0, 'AC']])])).toEqual([
    [0, 2 ** 31 + 10, 2 ** 31 + 12, 100],
  ])
})

test('the heatmap paints each run its ramp color, and the bars stand at it', () => {
  const r = buildIdentityRuns([block(100, 'ACGT', [[0, 'ACGA']])], 1)
  const spans = identitySpans(r)
  const bars = identityBars(r, new Uint32Array(r.count).fill(7))
  const spanColors = spans.color as Uint32Array
  expect(spanColors[0]).not.toBe(spanColors[1])
  expect(Array.from(bars.y)).toEqual([1, 0])
  expect(Array.from(bars.color as Uint32Array)).toEqual([7, 7])
  expect(identityBars(r, identityRunColors(r)).color).toEqual(spans.color)
})

test('the hover reads the mean over its window', () => {
  const blocks = [block(100, 'ACGTACGT', [[0, 'ATGTACGT']])]
  expect(identityOver(blocks, 0, 100, 104)).toEqual({
    identity: 0.75,
    bases: 4,
  })
  expect(identityOver(blocks, 0, 104, 108)).toEqual({ identity: 1, bases: 4 })
  expect(identityOver(blocks, 1, 100, 104)).toBeUndefined()
  expect(identityOver(blocks, 0, 500, 504)).toBeUndefined()
})

test('identityRgb ramps from divergent red through grey to conserved blue', () => {
  expect(identityRgb(0)).toBe('rgb(199,67,56)')
  expect(identityRgb(0.5)).toBe('rgb(140,140,140)')
  expect(identityRgb(1)).toBe('rgb(47,102,176)')
  expect(identityRgb(-1)).toBe('rgb(199,67,56)')
  expect(identityRgb(2)).toBe('rgb(47,102,176)')
})

test('the redgreyblue scheme is the identity ramp, at every hundredth', () => {
  const stops = colorRampStops({ scheme: 'redgreyblue' })
  for (let i = 0; i <= 100; i++) {
    const [r, g, b] = sampleColorRamp(stops, i / 100)
    expect(`rgb(${r},${g},${b})`).toBe(identityRgb(i / 100))
  }
})
