import type { Feature } from '@jbrowse/core/util'

export interface FeatureLayout {
  featureId: string
  x: number
  y: number
  width: number
  height: number
  totalFeatureHeight: number
  totalLayoutHeight: number
  totalLayoutWidth: number
  children: FeatureLayout[]
  glyphType: GlyphType
}

export type GlyphType =
  | 'Box'
  | 'ProcessedTranscript'
  | 'Segments'
  | 'Subfeatures'
  | 'CDS'

export interface RenderConfigContext {
  displayMode: string
  transcriptTypes: string[]
  containerTypes: string[]
  showLabels: boolean
  showDescriptions: boolean
  subfeatureLabels: string
  geneGlyphMode: string
  fontHeight: number
  featureHeight: number
  labelAllowed: boolean
  isHeightCallback: boolean
}

export interface FloatingLabelData {
  text: string
  relativeY: number
  color: string
  isOverlay?: boolean
}

export interface SubfeatureInfo {
  subfeatureId: string
  parentFeatureId: string
  type: string
  name: string
}

export interface ComputeLayoutsResult {
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
}

export interface Coord {
  x: number
  y: number
}

export interface DisplayModel {
  getFeatureByID?: (blockKey: string, featureId: string) => LayoutRect
  getFeatureOverlapping?: (
    blockKey: string,
    bp: number,
    y: number,
  ) => string | undefined
  selectedFeatureId?: string
  featureIdUnderMouse?: string
  contextMenuFeature?: Feature
}

type LayoutRect = [number, number, number, number]
