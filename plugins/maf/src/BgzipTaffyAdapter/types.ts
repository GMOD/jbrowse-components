export interface VirtualOffset {
  blockPosition: number // offset of the compressed data block
  dataPosition: number // offset into the uncompressed data
}

export interface ByteRange {
  chrStart: number
  virtualOffset: VirtualOffset
}

/**
 * A parsed `.tai`. A `Map` because the key order is load-bearing —
 * `nextChrStartBlock` reads "the chromosome after this one" off it and means
 * next *in the file*, which a plain object cannot express: JS enumerates
 * integer-like keys numerically, so an Ensembl-style index (`1`..`22`) put `2`
 * after `1` whatever the file's order.
 */
export type IndexData = Map<string, ByteRange[]>
