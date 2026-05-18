import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * Shared types for MAF alignment data
 */

/**
 * Options for MAF adapter getFeatures call.
 * Extends BaseOptions with optional samples filter for subtree optimization.
 */
export interface MafAdapterOptions extends BaseOptions {
  /** If provided, only parse alignments for these sample IDs */
  samples?: Sample[]
}

/**
 * Represents a single organism's alignment within a MAF block.
 * Used by adapters to return alignment data and by rendering code.
 */
export interface AlignmentRecord {
  /** Chromosome/contig name */
  chr: string
  /** Start position in the organism's coordinate system */
  start: number
  /** The aligned sequence (including gaps as '-') */
  seq: string
}

/**
 * A MAF feature containing alignments from multiple organisms
 */
export interface MafFeature {
  start: number
  end: number
  refName: string
  /** Reference sequence */
  seq: string
  /** Map of organism ID to alignment record */
  alignments: Record<string, AlignmentRecord>
}

/**
 * Sample/organism metadata for display
 */
export interface Sample {
  id: string
  label: string
  color?: string
}

/**
 * Genomic region for queries and rendering
 */
export interface GenomicRegion {
  start: number
  end: number
  refName: string
}
