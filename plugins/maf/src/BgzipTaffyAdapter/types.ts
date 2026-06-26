export interface VirtualOffset {
  blockPosition: number // offset of the compressed data block
  dataPosition: number // offset into the uncompressed data
}

export interface ByteRange {
  chrStart: number
  virtualOffset: VirtualOffset
}

export type IndexData = Record<string, ByteRange[]>
