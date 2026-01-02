import type { ExportSvgOptions } from '../LinearGenomeView/types'
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
  label?: string
  description?: string
  refName: string
  floatingLabels?: FloatingLabelData[]
  totalFeatureHeight?: number
  totalLayoutWidth?: number
  featureWidth?: number
  actualTopPx?: number
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
}): LayoutFeatureMetadata {
  return {
    refName: args.refName,
    floatingLabels: args.floatingLabels,
    totalFeatureHeight: args.totalFeatureHeight,
    totalLayoutWidth: args.totalLayoutWidth,
    featureWidth: args.featureWidth,
    actualTopPx: args.actualTopPx,
  }
}

export type LayoutRecord =
  | [number, number, number, number]
  | [number, number, number, number, LayoutFeatureMetadata]

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  overrideHeight?: number
  theme?: ThemeOptions
  legendWidth?: number
}
