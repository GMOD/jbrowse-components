// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw

import type BinaryParser from './binary.ts'
import type { BlockIndexEntry, Chromosome, HicRegion, Zoom } from './types.ts'

export default class MatrixZoomData {
  constructor(
    public chr1: Chromosome,
    public chr2: Chromosome,
    public zoom: Zoom,
    public blockBinCount: number,
    public blockColumnCount: number,
    public blockIndex: Record<number, BlockIndexEntry>,
  ) {}

  getKey() {
    return `${this.chr1.name}_${this.chr2.name}_${this.zoom.unit}_${this.zoom.binSize}`
  }

  getBlockNumbers(region1: HicRegion, region2: HicRegion, version: number) {
    const sameChr = this.chr1 === this.chr2
    const binsize = this.zoom.binSize
    const blockBinCount = this.blockBinCount
    const blockColumnCount = this.blockColumnCount

    // A Set dedups the block numbers that transposition can collide on the
    // same-chr diagonal, and keeps both branches uniform.
    const blockNumbers = new Set<number>()
    if (version < 9 || !sameChr) {
      const x1 = region1.start / binsize
      const x2 = region1.end / binsize
      const y1 = region2.start / binsize
      const y2 = region2.end / binsize

      const col1 = Math.floor(x1 / blockBinCount)
      const col2 = Math.floor((x2 - 1) / blockBinCount)
      const row1 = Math.floor(y1 / blockBinCount)
      const row2 = Math.floor((y2 - 1) / blockBinCount)

      for (let row = row1; row <= row2; row++) {
        for (let column = col1; column <= col2; column++) {
          blockNumbers.add(
            sameChr && row < column
              ? column * blockColumnCount + row
              : row * blockColumnCount + column,
          )
        }
      }
    } else {
      const binX1 = region1.start / binsize
      const binX2 = region1.end / binsize
      const binY1 = region2.start / binsize
      const binY2 = region2.end / binsize

      // PAD = positionAlongDiagonal (~projected). Depth is the axis
      // perpendicular to the diagonal; nearer means closer to the diagonal.
      const translatedLowerPAD = Math.floor((binX1 + binY1) / 2 / blockBinCount)
      const translatedHigherPAD = Math.floor(
        (binX2 + binY2) / 2 / blockBinCount,
      )
      const translatedNearerDepth = Math.floor(
        Math.log2(1 + Math.abs(binX1 - binY2) / Math.sqrt(2) / blockBinCount),
      )
      const translatedFurtherDepth = Math.floor(
        Math.log2(1 + Math.abs(binX2 - binY1) / Math.sqrt(2) / blockBinCount),
      )

      // code above assumes above diagonal, but we could be below it
      const containsDiagonal = (binX2 - binY1) * (binX1 - binY2) < 0
      const nearerDepth = containsDiagonal
        ? 0
        : Math.min(translatedNearerDepth, translatedFurtherDepth)
      const furtherDepth = Math.max(
        translatedNearerDepth,
        translatedFurtherDepth,
      )

      for (let depth = nearerDepth; depth <= furtherDepth; depth++) {
        for (let pad = translatedLowerPAD; pad <= translatedHigherPAD; pad++) {
          blockNumbers.add(depth * blockColumnCount + pad)
        }
      }
    }
    return [...blockNumbers]
  }

  static parseMatrixZoomData(
    chr1: Chromosome,
    chr2: Chromosome,
    dis: BinaryParser,
  ) {
    const unit = dis.getString()
    const zoomIndex = dis.getInt()
    dis.getFloat() // sumCounts
    dis.getFloat() // occupiedCellCount
    dis.getFloat() // stdDev
    dis.getFloat() // percent95
    const binSize = dis.getInt()
    const blockBinCount = dis.getInt()
    const blockColumnCount = dis.getInt()
    let nBlocks = dis.getInt()

    const blockIndex: Record<number, BlockIndexEntry> = {}
    while (nBlocks-- > 0) {
      const blockNumber = dis.getInt()
      const filePosition = dis.getLong()
      const size = dis.getInt()
      blockIndex[blockNumber] = { filePosition, size }
    }

    return new MatrixZoomData(
      chr1,
      chr2,
      { index: zoomIndex, unit, binSize },
      blockBinCount,
      blockColumnCount,
      blockIndex,
    )
  }
}
