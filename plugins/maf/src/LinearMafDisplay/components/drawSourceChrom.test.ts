import {
  SOURCE_CHROM_PALETTE,
  perRowChromRanks,
  sourceChromRankColor,
  sourceChromRankLabel,
} from './drawSourceChrom.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

// Minimal region factory: one block spanning [startBp,endBp) with the given
// per-row (rowIndex,chr) entries. Only the fields perRowChromRanks reads are set.
function region(
  blocks: { startBp: number; endBp: number; rows: [number, string][] }[],
): MafRegionData {
  return {
    blocks: blocks.map(b => ({
      startBp: b.startBp,
      endBp: b.endBp,
      refSeqBytes: new Uint8Array(),
      rows: b.rows.map(([rowIndex, chr]) => ({
        rowIndex,
        chr,
        alignmentBytes: new Uint8Array(),
        start: 0,
        strand: 1,
      })),
      empties: [],
    })),
  } as unknown as MafRegionData
}

describe('sourceChromRankColor / label', () => {
  test('rank 0 is the primary palette entry', () => {
    expect(sourceChromRankColor(0)).toBe(SOURCE_CHROM_PALETTE[0])
    expect(sourceChromRankLabel(0)).toBe('Main chromosome')
  })
  test('deep ranks clamp to the last palette entry / label', () => {
    const last = SOURCE_CHROM_PALETTE.length - 1
    expect(sourceChromRankColor(99)).toBe(SOURCE_CHROM_PALETTE[last])
    expect(sourceChromRankLabel(99)).toBe('Other source')
  })
})

describe('perRowChromRanks', () => {
  test('a row on a single chromosome ranks it 0 (maxRank 0)', () => {
    const { ranks, maxRank } = perRowChromRanks([
      region([{ startBp: 0, endBp: 100, rows: [[0, 'chrA']] }]),
    ])
    expect(ranks.get(0)?.get('chrA')).toBe(0)
    expect(maxRank).toBe(0)
  })

  test('within a row, the higher-bp chromosome is rank 0', () => {
    // chrA covers 100bp, chrB covers 30bp in row 0 -> chrA rank 0, chrB rank 1
    const { ranks, maxRank } = perRowChromRanks([
      region([
        { startBp: 0, endBp: 100, rows: [[0, 'chrA']] },
        { startBp: 200, endBp: 230, rows: [[0, 'chrB']] },
      ]),
    ])
    expect(ranks.get(0)?.get('chrA')).toBe(0)
    expect(ranks.get(0)?.get('chrB')).toBe(1)
    expect(maxRank).toBe(1)
  })

  test('rank is scoped per row — same name can be rank 0 in one row, rank 1 in another', () => {
    const { ranks } = perRowChromRanks([
      region([
        // row 0: mostly chrX; row 1: mostly chrY with a little chrX
        {
          startBp: 0,
          endBp: 100,
          rows: [
            [0, 'chrX'],
            [1, 'chrY'],
          ],
        },
        { startBp: 200, endBp: 260, rows: [[1, 'chrY']] },
        { startBp: 300, endBp: 310, rows: [[1, 'chrX']] },
      ]),
    ])
    expect(ranks.get(0)?.get('chrX')).toBe(0)
    expect(ranks.get(1)?.get('chrY')).toBe(0)
    expect(ranks.get(1)?.get('chrX')).toBe(1)
  })
})
