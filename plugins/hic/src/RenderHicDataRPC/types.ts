export interface HicContactItem {
  bin1: number
  bin2: number
  counts: number
  region1Idx: number
  region2Idx: number
}

export interface HicDataResult {
  positions: Float32Array
  counts: Float32Array
  numContacts: number
  colorMaxScore: number
  binWidth: number
  items: HicContactItem[]
  /**
   * Hover hit-test index. Key = `${r1}|${r2}|${bin1}|${bin2}`, value = index
   * into items. Every drawn rect is the same size and on a deterministic
   * grid, so a Map lookup replaces the previous Flatbush R-tree.
   */
  lookup: Record<string, number>
  /** Cumulative pixel-x offset of each region (length regions.length+1). */
  regionPixelStarts: number[]
  /**
   * Per-region offset baked into `positions[]`:
   * `positionX = (bin1 + regionCombinedOffsets[r1]) * binWidth`.
   * Hover subtracts this back out to recover bin1/bin2 from a mouse coord.
   */
  regionCombinedOffsets: number[]
}
