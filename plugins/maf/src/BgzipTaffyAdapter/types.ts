import type VirtualOffset from './virtualOffset'

// Re-export AlignmentRecord from central types for convenience
export type { AlignmentRecord } from '../types'

export interface ByteRange {
  chrStart: number
  virtualOffset: VirtualOffset
}

export type IndexData = Record<string, ByteRange[]>
