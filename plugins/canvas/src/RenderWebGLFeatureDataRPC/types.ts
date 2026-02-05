import type { FloatingLabelData } from '@jbrowse/plugin-linear-genome-view'

export interface RenderWebGLFeatureDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  rendererConfig: Record<string, unknown>
  region: {
    refName: string
    start: number
    end: number
    assemblyName?: string
  }
}

export interface WebGLFeatureDataResult {
  regionStart: number

  // Feature rectangles (box, CDS, UTR, exons)
  rectPositions: Uint32Array
  rectYs: Float32Array
  rectHeights: Float32Array
  rectColors: Uint32Array
  rectTypes: Uint8Array
  numRects: number

  // Connecting lines (introns)
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColors: Uint32Array
  numLines: number

  // Chevrons (strand indicators on introns)
  chevronXs: Uint32Array
  chevronYs: Float32Array
  chevronDirections: Int8Array
  chevronColors: Uint32Array
  numChevrons: number

  // Strand arrows (at feature ends)
  arrowXs: Uint32Array
  arrowYs: Float32Array
  arrowDirections: Int8Array
  arrowHeights: Float32Array
  arrowColors: Uint32Array
  numArrows: number

  // Hit detection
  flatbushData: ArrayBuffer
  flatbushItems: FlatbushItem[]
  subfeatureFlatbushData: ArrayBuffer
  subfeatureInfos: SubfeatureInfo[]

  // Floating labels metadata
  floatingLabelsData: FloatingLabelsDataMap

  // Layout info
  maxY: number
  totalHeight: number
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
