import { buildInstanceBuffer } from './mafInstanceBuffer.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_F32,
} from './shaders/maf.generated.ts'

import type { MafBlock } from './mafBackendTypes.ts'

interface DecodedRun {
  startBp: number
  endBp: number
  rowIndex: number
  color: number
}

function decodeRuns(buffer: ArrayBuffer, count: number): DecodedRun[] {
  const u32 = new Uint32Array(buffer)
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

function block(startBp: number, ref: string, rows: [number, string][]): MafBlock {
  const enc = new TextEncoder()
  return {
    startBp,
    refSeqBytes: enc.encode(ref),
    rows: rows.map(([rowIndex, seq]) => ({
      rowIndex,
      alignmentBytes: enc.encode(seq),
    })),
  }
}

const args = {
  colorForBase: { a: '#ff0000', c: '#00ff00', g: '#0000ff', t: '#ffff00', n: '#888' },
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
