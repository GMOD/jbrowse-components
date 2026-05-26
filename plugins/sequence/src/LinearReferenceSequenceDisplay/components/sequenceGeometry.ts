import { defaultStarts, defaultStops } from '@jbrowse/core/util'

import type { Frame } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

export type RGB = readonly [number, number, number]

export interface ColorEntry {
  rgb: RGB
  style: string
}

function hexToRGB(hex: string): RGB {
  const h = hex.replace('#', '')
  const full = h.length < 6 ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]! : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function rgbStyle([r, g, b]: RGB): string {
  return `rgb(${r},${g},${b})`
}

function entry(hex: string): ColorEntry {
  const rgb = hexToRGB(hex)
  return { rgb, style: rgbStyle(rgb) }
}

export interface ColorPalette {
  bases: Map<string, ColorEntry>
  frames: Map<Frame, ColorEntry>
  start: ColorEntry
  stop: ColorEntry
  fallback: ColorEntry
}

export function buildColorPalette(theme: Theme): ColorPalette {
  const themeBases = theme.palette.bases as Record<string, { main: string }>
  const bases = new Map<string, ColorEntry>()
  for (const base of ['A', 'C', 'G', 'T']) {
    bases.set(base, entry(themeBases[base]!.main))
  }
  const frames = new Map<Frame, ColorEntry>()
  for (const frame of [1, 2, 3, -1, -2, -3] as Frame[]) {
    frames.set(frame, entry(theme.palette.frames.at(frame)!.main))
  }
  return {
    bases,
    frames,
    start: entry(theme.palette.startCodon),
    stop: entry(theme.palette.stopCodon),
    fallback: entry('#aaaaaa'),
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
