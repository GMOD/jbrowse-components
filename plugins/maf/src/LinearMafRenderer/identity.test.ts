import {
  buildIdentityRuns,
  identityBars,
  identityColor,
  identityOver,
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

test('a reference N is unclassifiable', () => {
  expect(runs([block(100, 'NA', [[0, 'CA']])])).toEqual([[0, 101, 102, 100]])
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

test('each row keeps its own windows', () => {
  expect(
    runs([
      block(100, 'ACGT', [
        [0, 'ACGT'],
        [1, 'TTTT'],
      ]),
    ]).sort(),
  ).toEqual(
    [
      [0, 100, 104, 100],
      [1, 100, 103, 0],
      [1, 103, 104, 100],
    ].sort(),
  )
})

test('the heatmap paints each run its ramp colour, and the bars stand at it', () => {
  const r = buildIdentityRuns([block(100, 'ACGT', [[0, 'ACGA']])], 1)
  const spans = identitySpans(r)
  const bars = identityBars(r, false)
  expect(spans.color[0]).not.toBe(spans.color[1])
  expect(Array.from(bars.y)).toEqual([1, 0])
  expect(bars.color[0]).toBe(bars.color[1])
  expect(identityBars(r, true).color).toEqual(spans.color)
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

test('identityColor ramps from divergent red through grey to conserved blue', () => {
  expect(identityColor(0)).toEqual([199, 67, 56])
  expect(identityColor(0.5)).toEqual([140, 140, 140])
  expect(identityColor(1)).toEqual([47, 102, 176])
  expect(identityColor(-1)).toEqual([199, 67, 56])
  expect(identityColor(2)).toEqual([47, 102, 176])
})
