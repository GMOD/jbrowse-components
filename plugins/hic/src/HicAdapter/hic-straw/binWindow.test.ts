import { binWindow } from './binWindow.ts'
import HicFile from './hicFile.ts'
import MatrixZoomData from './matrixZoomData.ts'

import type { Chromosome, HicRegion } from './types.ts'

// JBrowse queries arbitrary viewport blocks, so `start % binsize !== 0` is the
// normal case, not the edge one. hic-straw compared bin indices against the raw
// fractional quotients, which silently dropped bins overlapping a region.

test('a bin overlapping either edge is in the window', () => {
  // binsize 100, region 250-750 → bins 2 (200-300) and 7 (700-800) both overlap
  expect(binWindow({ chr: '1', start: 250, end: 750 }, 100)).toEqual([2, 8])
})

test('a region narrower than one bin still selects the bin containing it', () => {
  expect(binWindow({ chr: '1', start: 210, end: 290 }, 100)).toEqual([2, 3])
})

test('an aligned region is unchanged', () => {
  expect(binWindow({ chr: '1', start: 200, end: 800 }, 100)).toEqual([2, 8])
})

// Stub everything below the record filter: one block holding bins 0..9 on the
// diagonal, so what comes back is purely a function of the bin window.
function fileWithDiagonalBins(n: number) {
  const diagonal = Int32Array.from({ length: n }, (_, i) => i)
  const records = {
    bin1: diagonal,
    bin2: diagonal,
    counts: new Float32Array(n).fill(1),
  }
  const file = new HicFile({
    file: { read: () => Promise.resolve(new ArrayBuffer(0)) },
  })
  Object.assign(file as unknown as Record<string, unknown>, {
    init: () => Promise.resolve(),
    chromosomeIndexMap: { '1': 0 },
    getBlocks: () => Promise.resolve([{ blockNumber: 0, records }]),
  })
  return file
}

async function binsIn(region: HicRegion, binsize: number) {
  const { records } = await fileWithDiagonalBins(10).getContactRecords(
    'NONE',
    region,
    region,
    'BP',
    binsize,
  )
  return [...records.bin1]
}

test('the record filter keeps every bin overlapping a non-aligned region', async () => {
  // bin 2 (200-300) overlaps 250-750 and used to be dropped, while bin 7
  // (700-800) — overlapping by the same kind of partial slice at the other end
  // — was kept, so the matrix lost a column only at its left edge
  await expect(
    binsIn({ chr: '1', start: 250, end: 750 }, 100),
  ).resolves.toEqual([2, 3, 4, 5, 6, 7])
})

test('a region narrower than one bin is not an empty matrix', async () => {
  // reachable by locking a coarse binsize from the resolution dropdown while
  // zoomed in; this used to blank the whole display with no error
  await expect(
    binsIn({ chr: '1', start: 210, end: 290 }, 100),
  ).resolves.toEqual([2])
})

// The two halves have to agree: widening the record filter alone still loses
// records whose block was never requested.
describe('block selection covers the same window', () => {
  const chr: Chromosome = { index: 0, name: '1', size: 1_000_000 }
  const BLOCK_BIN_COUNT = 10

  function zoomData(binSize: number) {
    return new MatrixZoomData(
      chr,
      chr,
      { index: 0, unit: 'BP', binSize },
      BLOCK_BIN_COUNT,
      100,
      {},
    )
  }

  test('a bin past a block boundary pulls in the next block', () => {
    // binsize 100, blockBinCount 10 → block 0 is bins 0-9, block 1 is bins
    // 10-19. Region 500-1050 ends inside bin 10, which lives in block 1;
    // `floor((end/binsize) - 1)` on the fractional quotient stopped at block 0.
    const region = { chr: '1', start: 500, end: 1050 }
    const nums = zoomData(100).getBlockNumbers(region, region, 8)
    // same-chr blocks are keyed row*blockColumnCount + column, spelled out
    // rather than folded so the two expectations read as the same formula
    // eslint-disable-next-line unicorn/no-constant-zero-expression
    expect(nums).toContain(0 * 100 + 0)
    expect(nums).toContain(1 * 100 + 1)
  })

  test('a sub-bin region still asks for its block', () => {
    const region = { chr: '1', start: 210, end: 290 }
    expect(zoomData(100).getBlockNumbers(region, region, 8)).toEqual([0])
  })

  test('v9 diagonal selection also covers a sub-bin region', () => {
    const region = { chr: '1', start: 210, end: 290 }
    expect(zoomData(100).getBlockNumbers(region, region, 9)).not.toHaveLength(0)
  })
})
