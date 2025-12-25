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
  tooltip?: string
}

export type LayoutRecord =
  | [number, number, number, number]
  | [
      number,
      number,
      number,
      number,
      {
        label?: string
        description?: string
        refName: string
        floatingLabels?: FloatingLabelData[]
        totalFeatureHeight?: number
        totalLayoutWidth?: number
        featureWidth?: number
        leftPadding?: number
        actualTopPx?: number
      },
    ]

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  overrideHeight?: number
  theme?: ThemeOptions
}
