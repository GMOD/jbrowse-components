import type { ExportSvgOptions } from '../LinearGenomeView/types.ts'
import type { ThemeOptions } from '@mui/material'

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}

export type LayoutRecord = [number, number, number, number]

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  overrideHeight?: number
  theme?: ThemeOptions
  legendWidth?: number
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}
