import { buildInstanceBuffer } from './mafInstanceBuffer.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_F32,
} from './shaders/maf.generated.ts'

import type { MafBlock } from './mafRenderingBackendTypes.ts'

interface DecodedRun {
  startBp: number
  endBp: number
  rowIndex: number
  color: number
}

function decodeRuns(u32: Uint32Array, count: number): DecodedRun[] {
  const runs: DecodedRun[] = []
  for (let i = 0; i < count; i++) {
    const base = i * INSTANCE_STRIDE_F32
    runs.push({
      startBp: u32[base + FIELD_OFFSET_F32.startBp]!,
      endBp: u32[base + FIELD_OFFSET_F32.endBp]!,
      rowIndex: u32[base + FIELD_OFFSET_F32.rowIndex]!,
      color: u32[base + FIELD_OFFSET_F32.color]!,
    })
  }
  return runs
}

function block(
  startBp: number,
  ref: string,
  rows: [number, string][],
): MafBlock {
  const enc = new TextEncoder()
  return {
    startBp,
    endBp: startBp + ref.replaceAll('-', '').length,
    refSeqBytes: enc.encode(ref),
    rows: rows.map(([rowIndex, seq]) => ({
      rowIndex,
      alignmentBytes: enc.encode(seq),
    })),
    empties: [],
  }
}

const args = {
  binBp: 1,
  palette: {
    colorForBase: {
      a: '#ff0000',
      c: '#00ff00',
      g: '#0000ff',
      t: '#ffff00',
      n: '#888',
    },
    matchColor: '#d3d3d3',
    gapColor: '#1e1e1e',
    mismatchOffColor: '#ffa500',
    unknownBaseColor: '#000000',
    insertionColor: '#800080',
    bridgeLineColor: '#888888',
    missingDataColor: '#ffffcc',
  },
  showAllLetters: false,
  mismatchRendering: true,
}

test('two disjoint blocks emit runs at distinct absolute positions', () => {
  // Block 1 at 100-105 (5 matches), block 2 at 1100-1105 (5 matches)
  // With showAllLetters=false, matches collapse into a single MATCH_COLOR run.
  const blocks = [
    block(100, 'ACGTA', [[0, 'ACGTA']]),
    block(1100, 'ACGTA', [[0, 'ACGTA']]),
  ]
  const { buffer, count } = buildInstanceBuffer({ blocks, ...args })
  const runs = decodeRuns(buffer, count)

  expect(runs).toHaveLength(2)
  expect(runs[0]).toMatchObject({ startBp: 100, endBp: 105, rowIndex: 0 })
  expect(runs[1]).toMatchObject({ startBp: 1100, endBp: 1105, rowIndex: 0 })
})

test('mismatch in a later block does not bleed into the earlier block', () => {
  // Block 1 fully matches; block 2 has a mismatch at offset 2.
  // The mismatch must appear at bp 1102, not anywhere near block 1.
  const blocks = [
    block(100, 'ACGTA', [[0, 'ACGTA']]),
    block(1100, 'ACGTA', [[0, 'ACTTA']]),
  ]
  const { buffer, count } = buildInstanceBuffer({ blocks, ...args })
  const runs = decodeRuns(buffer, count)

  const mismatch = runs.find(r => r.startBp === 1102)
  expect(mismatch).toBeDefined()
  expect(mismatch!.endBp).toBe(1103)
  expect(mismatch!.rowIndex).toBe(0)
  // No run should straddle the gap between the two blocks
  expect(runs.every(r => r.endBp <= 105 || r.startBp >= 1100)).toBe(true)
})

describe('binned encode (zoomed out)', () => {
  // 16 reference bases, one mismatch at genomic offset 9. With binBp=4 the
  // samples land at offsets 0, 4, 8, 12 — the mismatch at 9 is not sampled, so
  // the whole row collapses to one match run. That is the point: at this zoom
  // a single base is a fraction of a pixel.
  const ref = 'ACGTACGTACGTACGT'

  test('collapses a block to one run per bin, merging equal neighbours', () => {
    const blocks = [block(100, ref, [[0, ref]])]
    const { buffer, count } = buildInstanceBuffer({
      blocks,
      ...args,
      binBp: 4,
    })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 116, rowIndex: 0 })
  })

  test('a sampled mismatch breaks the run at its bin boundary', () => {
    // Mismatch at genomic offset 8, which bin 2 samples.
    const aln = 'ACGTACGTTCGTACGT'
    const blocks = [block(100, ref, [[0, aln]])]
    const { buffer, count } = buildInstanceBuffer({
      blocks,
      ...args,
      binBp: 4,
    })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(3)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 108 })
    expect(runs[1]).toMatchObject({ startBp: 108, endBp: 112 })
    expect(runs[2]).toMatchObject({ startBp: 112, endBp: 116 })
    expect(runs[0]!.color).toBe(runs[2]!.color)
    expect(runs[1]!.color).not.toBe(runs[0]!.color)
  })

  test('reference insertions consume no genomic position', () => {
    // 4 inserted reference columns in the middle; the block still spans 16bp.
    const refIns = 'ACGTACGT----ACGTACGT'
    const blocks = [block(100, refIns, [[0, 'ACGTACGTAAAAACGTACGT']])]
    const { buffer, count } = buildInstanceBuffer({
      blocks,
      ...args,
      binBp: 4,
    })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 116 })
  })

  test('a trailing partial bin clamps to the block end', () => {
    const blocks = [block(100, 'ACGTAC', [[0, 'ACGTAC']])]
    const { buffer, count } = buildInstanceBuffer({
      blocks,
      ...args,
      binBp: 4,
    })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 106 })
  })

  test('a row shorter than the reference closes its run early', () => {
    const blocks = [block(100, ref, [[0, 'ACGTACGT']])]
    const { buffer, count } = buildInstanceBuffer({
      blocks,
      ...args,
      binBp: 4,
    })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 108 })
  })
})

describe('gap runs at a block boundary', () => {
  test('a trailing gap run paints nothing', () => {
    const blocks = [block(100, 'ACGTA', [[0, 'ACG--']])]
    const { buffer, count } = buildInstanceBuffer({ blocks, ...args })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 103 })
  })

  test('a leading gap run paints nothing', () => {
    const blocks = [block(100, 'ACGTA', [[0, '--GTA']])]
    const { buffer, count } = buildInstanceBuffer({ blocks, ...args })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ startBp: 102, endBp: 105 })
  })

  test('an all-gap row emits nothing', () => {
    const blocks = [block(100, 'ACGTA', [[0, '-----']])]
    const { count } = buildInstanceBuffer({ blocks, ...args })
    expect(count).toBe(0)
  })

  test('an abutting block that resumes makes a trailing run a real deletion', () => {
    // block 2 starts at 105 with aligned sequence, so block 1's trailing gap is
    // bounded and paints; without the neighbour it would be blank
    const blocks = [
      block(100, 'ACGTA', [[0, 'ACG--']]),
      block(105, 'ACGTA', [[0, 'ACGTA']]),
    ]
    const { buffer, count } = buildInstanceBuffer({ blocks, ...args })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(3)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 103 })
    expect(runs[1]).toMatchObject({ startBp: 103, endBp: 105 })
    expect(runs[2]).toMatchObject({ startBp: 105, endBp: 110 })
    expect(runs[1]!.color).not.toBe(runs[0]!.color)
  })

  test('a neighbour that also starts with a gap leaves both fragments blank', () => {
    const blocks = [
      block(100, 'ACGTA', [[0, 'ACG--']]),
      block(105, 'ACGTA', [[0, '--GTA']]),
    ]
    const { buffer, count } = buildInstanceBuffer({ blocks, ...args })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 103 })
    expect(runs[1]).toMatchObject({ startBp: 107, endBp: 110 })
  })

  test('an interior gap run still paints, and does not merge across a boundary run', () => {
    // gapColor differs from matchColor, so the interior gap is its own run and
    // the trailing gap must not extend it.
    const blocks = [block(100, 'ACGTACG', [[0, 'A--TAC-']])]
    const { buffer, count } = buildInstanceBuffer({ blocks, ...args })
    const runs = decodeRuns(buffer, count)
    expect(runs).toHaveLength(3)
    expect(runs[0]).toMatchObject({ startBp: 100, endBp: 101 })
    expect(runs[1]).toMatchObject({ startBp: 101, endBp: 103 })
    expect(runs[2]).toMatchObject({ startBp: 103, endBp: 106 })
    expect(runs[0]!.color).toBe(runs[2]!.color)
    expect(runs[1]!.color).not.toBe(runs[0]!.color)
  })
})
