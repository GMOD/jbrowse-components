import { defaultStarts, defaultStops } from '@jbrowse/core/util'

import type { Frame } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

type RGB = readonly [number, number, number]

function hexToRGB(hex: string): RGB {
  const h = hex.replace('#', '')
  const full = h.length < 6 ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]! : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

export interface ColorPalette {
  baseColors: Map<string, RGB>
  frameColors: Map<number, RGB>
  startColor: RGB
  stopColor: RGB
}

export function buildColorPalette(theme: Theme): ColorPalette {
  const bases = theme.palette.bases as Record<string, { main: string }>
  const baseColors = new Map<string, RGB>()
  for (const base of ['A', 'C', 'G', 'T']) {
    baseColors.set(base, hexToRGB(bases[base]!.main))
  }

  const frameColors = new Map<number, RGB>()
  for (const frame of [1, 2, 3, -1, -2, -3] as Frame[]) {
    frameColors.set(frame, hexToRGB(theme.palette.frames.at(frame)!.main))
  }

  return {
    baseColors,
    frameColors,
    startColor: hexToRGB(theme.palette.startCodon),
    stopColor: hexToRGB(theme.palette.stopCodon),
  }
}

export const startsSet = new Set(defaultStarts)
export const stopsSet = new Set(defaultStops)

export function frameShiftBounds(seq: string, seqStart: number, frame: Frame) {
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3
  const adjLen = seq.length - frameShift
  const sliceEnd = frameShift + adjLen - (adjLen % 3)
  return { frameShift, sliceEnd }
}
