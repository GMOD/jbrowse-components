/**
 * WebGL Feature Data RPC Types
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * regionStart must be an integer (use Math.floor of view region start).
 * All position arrays store integer offsets from regionStart.
 * This is critical for alignment between features and hit detection.
 */

import type { FloatingLabelData } from '@jbrowse/plugin-linear-genome-view'

export interface RenderWebGLFeatureDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  displayConfig: {
    showLabels: boolean
    showDescriptions: boolean
    geneGlyphMode: string
  }
  region: {
    refName: string
    start: number
    end: number
    assemblyName?: string
    reversed?: boolean
  }
  bpPerPx: number
  colorByCDS?: boolean
  sequenceAdapter?: Record<string, unknown>
  showOnlyGenes?: boolean
  maxFeatureCount?: number
  stopToken?: string
}

export interface WebGLFeatureDataResult {
  // Integer reference point for all positions (floor of view region start).
  // All position data in this result is stored as integer offsets from regionStart.
  regionStart: number

  // Feature rectangles (box, CDS, UTR, exons)
  rectPositions: Uint32Array
  rectYs: Float32Array
  rectHeights: Float32Array
  rectColors: Uint8Array
  numRects: number

  // Connecting lines (introns) with strand info for dynamic chevron generation
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColors: Uint8Array
  lineDirections: Int8Array // strand direction: -1, 0, or 1
  numLines: number

  // Strand arrows (at feature ends)
  arrowXs: Uint32Array
  arrowYs: Float32Array
  arrowDirections: Int8Array
  arrowHeights: Float32Array
  arrowColors: Uint8Array
  numArrows: number

  // Hit detection
  flatbushData: ArrayBuffer
  flatbushItems: FlatbushItem[]
  subfeatureFlatbushData: ArrayBuffer
  subfeatureInfos: SubfeatureInfo[]

  // Floating labels metadata
  floatingLabelsData: FloatingLabelsDataMap

  // Precomputed amino acid overlay items (only when colorByCDS is true)
  aminoAcidOverlay?: AminoAcidOverlayItem[]

  // Layout info
  maxY: number
  totalHeight: number
}

export interface RegionTooLargeResult {
  regionTooLarge: true
  featureCount: number
}

export type RenderWebGLFeatureDataResult =
  | WebGLFeatureDataResult
  | RegionTooLargeResult

export interface AminoAcidOverlayItem {
  startBp: number
  endBp: number
  aminoAcid: string
  proteinIndex: number
  topPx: number
  heightPx: number
  isStopOrNonTriplet: boolean
}

export interface FlatbushItem {
  featureId: string
  type: string
  startBp: number
  endBp: number
  topPx: number
  bottomPx: number
  tooltip: string
  name?: string
  strand?: number
}

export interface SubfeatureInfo {
  featureId: string
  parentFeatureId: string
  type: string
  startBp: number
  endBp: number
  topPx: number
  bottomPx: number
  displayLabel?: string
  tooltip?: string
}

export interface FeatureLabelData {
  featureId: string
  minX: number
  maxX: number
  topY: number
  featureHeight: number
  floatingLabels: FloatingLabelData[]
}

export type FloatingLabelsDataMap = Record<string, FeatureLabelData>
