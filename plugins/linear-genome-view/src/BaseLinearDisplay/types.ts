import type { ExportSvgOptions } from '../LinearGenomeView/types.ts'
import type { ThemeOptions } from '@mui/material'

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}

export interface FloatingLabelData {
  text: string
  relativeY: number
  color: string
  textWidth: number
  isOverlay?: boolean
  parentFeatureId?: string
  subfeatureId?: string
  tooltip?: string
}

/**
 * Metadata attached to layout rectangles for floating label rendering.
 * Used by both parent features and subfeatures.
 */
export interface LayoutFeatureMetadata {
  refName: string
  floatingLabels?: FloatingLabelData[]
  totalFeatureHeight?: number
  totalLayoutWidth?: number
  featureWidth?: number
  actualTopPx?: number
  /** Actual feature start in bp (not layout start which includes padding) */
  featureStartBp?: number
  /** Actual feature end in bp (not layout end which includes padding) */
  featureEndBp?: number
}

/**
 * Creates metadata for floating label rendering on subfeatures.
 */
export function createSubfeatureLabelMetadata(args: {
  refName: string
  floatingLabels: FloatingLabelData[]
  totalFeatureHeight: number
  totalLayoutWidth: number
  featureWidth: number
  actualTopPx: number
  featureStartBp: number
  featureEndBp: number
}): LayoutFeatureMetadata {
  return { ...args }
}

export type LayoutRecord =
  | [number, number, number, number]
  | [number, number, number, number, LayoutFeatureMetadata]

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  overrideHeight?: number
  theme?: ThemeOptions
  legendWidth?: number
}
