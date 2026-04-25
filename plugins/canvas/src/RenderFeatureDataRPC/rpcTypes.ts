/**
 * WebGL Feature Data RPC Types
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * regionStart must be an integer (use Math.floor of view region start).
 * All position arrays store integer offsets from regionStart.
 * This is critical for alignment between features and hit detection.
 */

import type { DisplayConfig } from './renderConfig.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface LabelItem {
  text: string
  relativeY: number
  color: string
  textWidth: number
}

export interface RenderFeatureDataArgs {
  [key: string]: unknown
  sessionId: string
  adapterConfig: Record<string, unknown>
  displayConfig: DisplayConfig
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
    reversed?: boolean
    seqAdapterRefName?: string
  }
  bpPerPx: number
  colorByCDS?: boolean
  sequenceAdapter?: Record<string, unknown>
  showOnlyGenes?: boolean
  maxFeatureDensity?: number
  stopToken?: StopToken
  statusCallback?: (msg: string) => void
}

export interface FeatureDataResult {
  // Integer reference point for all positions (floor of view region start).
  // All position data in this result is stored as integer offsets from regionStart.
  regionStart: number

  // Feature rectangles (box, CDS, UTR, exons)
  rectPositions: Uint32Array
  rectYs: Float32Array
  rectHeights: Float32Array
  // RGBA packed as a single u32 per rect (R=byte0 … A=byte3). Consumed
  // directly by interleaveRects — the rect shader unpacks with bit shifts.
  rectColors: Uint32Array

  // Connecting lines (introns) with strand info for dynamic chevron generation
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColors: Uint32Array
  lineDirections: Int8Array // strand direction: -1, 0, or 1

  // Strand arrows (at feature ends)
  arrowXs: Uint32Array
  arrowYs: Float32Array
  arrowDirections: Int8Array
  arrowColors: Uint32Array

  // Hit detection
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]

  // Maps each rect/line/arrow element → flatbushItem index (for main-thread layout)
  rectFeatureIndices: Uint32Array
  lineFeatureIndices: Uint32Array
  arrowFeatureIndices: Uint32Array

  // Floating labels metadata
  floatingLabelsData: FloatingLabelsDataMap

  // Precomputed amino acid overlay items (only when colorByCDS is true)
  aminoAcidOverlay?: AminoAcidOverlayItem[]

  // Number of top-level features in this region (used for density calculations)
  featureCount: number

  // Packed RGBA outline color for all rects (0 = no outline)
  outlineColor: number
}

export type RegionRenderData = Pick<
  FeatureDataResult,
  | 'regionStart'
  | 'rectPositions'
  | 'rectYs'
  | 'rectHeights'
  | 'rectColors'
  | 'outlineColor'
  | 'linePositions'
  | 'lineYs'
  | 'lineColors'
  | 'lineDirections'
  | 'arrowXs'
  | 'arrowYs'
  | 'arrowDirections'
  | 'arrowColors'
>

export interface RegionTooLargeResult {
  regionTooLarge: true
  featureCount: number
}

export type RenderFeatureDataResult = FeatureDataResult | RegionTooLargeResult

export interface AminoAcidOverlayItem {
  startBp: number
  endBp: number
  aminoAcid: string
  proteinIndex: number
  topPx: number
  heightPx: number
  isStopOrNonTriplet: boolean
  flatbushIdx: number
}

interface HitItemBase {
  featureId: string
  type: string
  startBp: number
  endBp: number
  topPx: number
  bottomPx: number
}

export interface FlatbushItem extends HitItemBase {
  kind: 'feature'
  featureHeightPx: number
  tooltip: string
  name?: string
  strand?: number
}

export interface SubfeatureInfo extends HitItemBase {
  kind: 'subfeature'
  parentFeatureId: string
  displayLabel?: string
  tooltip?: string
}

export interface FeatureLabelData {
  featureId: string
  minX: number
  maxX: number
  topY: number
  featureHeight: number
  nameLabel?: LabelItem
  descriptionLabel?: LabelItem
  parentFeatureId?: string
  subfeatureLabel?: LabelItem & { isOverlay: boolean; tooltip: string }
}

// Returns the max rendered width of any label that will actually display for
// this feature. Mirrors the visibility logic in useOverlayElements: name is
// gated on showLabels, description is gated on showDescriptions only (not
// showLabels), subfeature labels always render.
export function maxLabelTextWidth(
  labelData: FeatureLabelData,
  showLabels = true,
  showDescriptions = true,
) {
  const nameWidth = showLabels ? (labelData.nameLabel?.textWidth ?? 0) : 0
  const descWidth = showDescriptions
    ? (labelData.descriptionLabel?.textWidth ?? 0)
    : 0
  const subfeatureWidth = labelData.subfeatureLabel?.textWidth ?? 0
  return Math.max(nameWidth, descWidth, subfeatureWidth)
}

export type FloatingLabelsDataMap = Record<string, FeatureLabelData>
