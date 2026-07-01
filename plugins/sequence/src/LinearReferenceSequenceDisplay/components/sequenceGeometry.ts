import { defaultStarts } from '@jbrowse/core/util'

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
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
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

export function buildColorPalette(
  theme: Theme,
  colorByCDS: boolean,
): ColorPalette {
  const themeBases = theme.palette.bases as Record<string, { main: string }>
  const bases = new Map<string, ColorEntry>()
  for (const base of ['A', 'C', 'G', 'T']) {
    bases.set(base, entry(themeBases[base]!.main))
  }
  const frames = new Map<Frame, ColorEntry>()
  // Frames array layout: [null, f1, f2, f3, f-3, f-2, f-1]
  // null at index 0 lets positive frames use 1-based .at(1/2/3);
  // negative frames use JS .at() negative-index semantics.
  // colorByCDS matches the bright per-frame CDS palette used by gene tracks so
  // the translation rows line up visually with colored CDS features.
  const framePalette = colorByCDS
    ? theme.palette.framesCDS
    : theme.palette.frames
  for (const frame of [1, 2, 3, -1, -2, -3] as Frame[]) {
    frames.set(frame, entry(framePalette.at(frame)!.main))
  }
  return {
    bases,
    frames,
    start: entry(theme.palette.startCodon),
    stop: entry(theme.palette.stopCodon),
    fallback: entry('#aaaaaa'),
  }
}

const startsSet = new Set(defaultStarts)

export type CodonKind = 'start' | 'stop' | 'normal'

// Stops come from the active genetic code (a codon mapping to '*'), so e.g. the
// mitochondrial code marks AGA/AGG as stops and TGA as Trp. Start highlighting
// stays ATG-only: alternative initiators (GTG/TTG) only act as starts at a true
// CDS 5' end, so flagging every occurrence in a raw 3-frame translation would be
// misleading noise.
export function codonKind(
  upperCodon: string,
  codonTable: Record<string, string>,
): CodonKind {
  return startsSet.has(upperCodon)
    ? 'start'
    : codonTable[upperCodon] === '*'
      ? 'stop'
      : 'normal'
}

/**
 * `frameShift` is the index of the first in-frame codon boundary (so the codon
 * grid is anchored to absolute genomic coordinate mod 3, independent of where
 * the fetched region happens to start); `sliceEnd` is the index just past the
 * last complete codon.
 */
export function frameShiftBounds(seq: string, seqStart: number, frame: Frame) {
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3
  const adjLen = seq.length - frameShift
  const sliceEnd = frameShift + adjLen - (adjLen % 3)
  return { frameShift, sliceEnd }
}

/**
 * Half-open `[start, end)` index range into a sequence that overlaps a block.
 * `Math.floor`/`Math.ceil` cover fractional bpPerPx where block edges land on
 * non-integer genomic positions.
 */
export function visibleRange(
  blockStart: number,
  blockEnd: number,
  seqStart: number,
  seqLen: number,
) {
  return {
    start: Math.max(0, Math.floor(blockStart - seqStart)),
    end: Math.min(seqLen, Math.ceil(blockEnd - seqStart)),
  }
}

/**
 * Codon-aligned half-open `[start, end)` index range to paint for one frame:
 * the visible range widened by one codon of slop (so a codon straddling either
 * edge still renders), snapped back to the `frameShift` codon grid, and clamped
 * to the last complete codon (`sliceEnd`).
 */
export function visibleCodonRange(
  blockStart: number,
  blockEnd: number,
  seqStart: number,
  seqLen: number,
  frameShift: number,
  sliceEnd: number,
) {
  const { start, end } = visibleRange(blockStart, blockEnd, seqStart, seqLen)
  const from = Math.max(frameShift, start - 3)
  return {
    start: from - ((from - frameShift) % 3),
    end: Math.min(sliceEnd, end + 3),
  }
}
