import { pathStripBlocks, segmentSizeSummary } from './pathStripBlocks.ts'

import type { DerivativeSegment } from '@jbrowse/plugin-alignments'

function seg(
  refName: string,
  start: number,
  end: number,
  strand = 1,
): DerivativeSegment {
  return { refName, start, end, strand }
}

// COLO829's der(3), the path the cancer_sv tutorial reconstructs: a 52.3kb chr3
// arm, a 199bp hop through chr10, a 183bp inverted piece of chr12, then 8.4kb of
// chr3 coming back inverted.
const der3 = [
  seg('3', 25_307_233, 25_359_568),
  seg('10', 58_717_463, 58_717_662),
  seg('12', 72_273_111, 72_273_294, -1),
  seg('3', 25_350_684, 25_359_111, -1),
]

describe('pathStripBlocks', () => {
  it('gives every segment a visible block, however small', () => {
    const blocks = pathStripBlocks(der3, { width: 460 })
    expect(blocks).toHaveLength(4)
    for (const block of blocks) {
      expect(block.width).toBeGreaterThanOrEqual(5)
    }
    // the 52kb arm still dominates: the point of the strip is that the reader
    // sees one big piece and three slivers rather than four equal names
    expect(blocks[0]!.width).toBeGreaterThan(300)
    expect(blocks[1]!.width).toBeCloseTo(5)
    expect(blocks[2]!.width).toBeCloseTo(5)
  })

  it('fills the requested width, gaps included', () => {
    const blocks = pathStripBlocks(der3, { width: 460, gap: 2 })
    const last = blocks.at(-1)!
    expect(last.x + last.width).toBeCloseTo(460)
  })

  it('reuses one color per chromosome, so a return trip reads as one', () => {
    const blocks = pathStripBlocks(der3, { width: 460 })
    expect(blocks.map(b => b.colorIndex)).toEqual([0, 1, 2, 0])
  })

  it('carries strand and a full hover title per block', () => {
    const blocks = pathStripBlocks(der3, { width: 460 })
    expect(blocks[2]!.strand).toBe(-1)
    expect(blocks[2]!.title).toBe('12:72,273,111-72,273,294 (183bp, inverted)')
    expect(blocks[0]!.title).toBe('3:25,307,233-25,359,568 (52.3Kbp)')
  })

  it('falls back to equal blocks when the floor cannot be met', () => {
    // 40 hops at a 5px floor need 200px of blocks plus 78px of gaps; at 120px
    // there is no proportional information left to draw, so it draws none
    const many = Array.from({ length: 40 }, (_, i) =>
      seg(`chr${i}`, 0, (i + 1) * 1000),
    )
    const blocks = pathStripBlocks(many, { width: 120 })
    const widths = new Set(blocks.map(b => b.width.toFixed(4)))
    expect(widths.size).toBe(1)
  })

  it('pins iteratively rather than in one pass', () => {
    // one huge segment and three slivers: pinning the slivers must not leave
    // the pool re-scaled such that a fourth falls under the floor unnoticed
    const blocks = pathStripBlocks(
      [
        seg('1', 0, 1_000_000),
        seg('2', 0, 10),
        seg('3', 0, 10),
        seg('4', 0, 10),
      ],
      { width: 100, gap: 0, minBlockWidth: 5 },
    )
    expect(blocks.map(b => b.width)).toEqual([85, 5, 5, 5])
  })

  it('stays inside the strip however many hops the path has', () => {
    // Nothing upstream bounds the segment count, and past the point where the
    // gaps alone fill the strip the blocks were laid out beyond it: at 460px
    // and a 2px gap, 200 segments ran to 598px, so a third of the path was
    // drawn outside the viewBox and silently clipped.
    for (const n of [1, 2, 154, 155, 200, 943]) {
      const many = Array.from({ length: n }, (_, i) =>
        seg(`chr${i}`, 0, (i + 1) * 1000),
      )
      const blocks = pathStripBlocks(many, { width: 460 })
      expect(blocks).toHaveLength(n)
      expect(blocks.at(-1)!.x + blocks.at(-1)!.width).toBeLessThanOrEqual(460.5)
      for (const block of blocks) {
        expect(block.width).toBeGreaterThan(0)
      }
    }
  })

  it('draws nothing for an empty path', () => {
    expect(pathStripBlocks([], { width: 460 })).toEqual([])
  })
})

describe('segmentSizeSummary', () => {
  it('lists the sizes in path order, marking inversions', () => {
    expect(segmentSizeSummary(der3)).toBe(
      '52.3Kbp, 199bp, 183bp inv, 8.43Kbp inv',
    )
  })

  it('distinguishes an allele from an aligner splitting a read', () => {
    // the case the total span cannot see: both paths total ~61kb
    const artifact = [
      seg('1', 0, 15_000),
      seg('2', 0, 15_000),
      seg('3', 0, 15_000),
      seg('4', 0, 16_000),
    ]
    expect(segmentSizeSummary(artifact)).toBe('15Kbp, 15Kbp, 15Kbp, 16Kbp')
    expect(segmentSizeSummary(der3)).not.toBe(segmentSizeSummary(artifact))
  })

  it('collapses to the range once the list stops being readable', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      seg('1', 0, (i + 1) * 1000),
    )
    expect(segmentSizeSummary(many)).toBe('smallest 1Kbp, largest 9Kbp')
  })

  it('says nothing about an empty path', () => {
    expect(segmentSizeSummary([])).toBe('')
  })
})
