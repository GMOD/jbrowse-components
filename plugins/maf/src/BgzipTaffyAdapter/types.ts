import type VirtualOffset from './virtualOffset.ts'

// Re-export AlignmentRecord from central types for convenience
export type { AlignmentRecord } from '../types.ts'

export interface ByteRange {
  chrStart: number
  virtualOffset: VirtualOffset
}

export type IndexData = Record<string, ByteRange[]>
