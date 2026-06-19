import { useEffect, useRef } from 'react'
import type React from 'react'

import {
  colorFwdStrand,
  colorInterchrom,
  colorLongInsert,
  colorNostrand,
  colorRevStrand,
  colorShortInsert,
  colorSupplementary,
  colorUnmappedMate,
} from '@jbrowse/core/ui/theme'

import { toRgb } from '../shaders/colors.ts'

import type { CigarCoords } from '../../shared/hitTestTypes.ts'
import type { ColorPalette, RGBColor } from '../shaders/colors.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'

export function makeBpToScreenX(view: LinearGenomeViewModel) {
  const { offsetPx } = view
  return (refName: string, bp: number) => {
    const r = view.bpToPx({ refName, coord: bp })
    return r === undefined ? undefined : r.offsetPx - offsetPx
  }
}

// Mix a normalized RGB color toward white by `amt` (0 = unchanged, 1 = white).
function lighten([r, g, b]: RGBColor, amt: number): RGBColor {
  return [r + (1 - r) * amt, g + (1 - g) * amt, b + (1 - b) * amt]
}

// Coverage-track indicator marks sit on the dark track background in dark mode,
// where the saturated on-read insertion/clip colors wash out. Lighten them for
// that context only; the on-read box/bar/text keep the saturated base color.
const INDICATOR_DARK_LIGHTEN = 0.45

export function buildColorPaletteFromTheme(theme: Theme): ColorPalette {
  const { palette } = theme
  // 0 in light mode leaves the indicator colors equal to the base colors
  const indicatorLighten = palette.mode === 'dark' ? INDICATOR_DARK_LIGHTEN : 0
  const colorInsertion = toRgb(palette.insertion)
  const colorSoftclip = toRgb(palette.softclip)
  const colorHardclip = toRgb(palette.hardclip)
  return {
    colorFwdStrand: toRgb(colorFwdStrand),
    colorRevStrand: toRgb(colorRevStrand),
    colorNostrand: toRgb(colorNostrand),
    // pair colors flow through palette.alignmentFill so user theme overrides
    // render and dark mode dims pairLR (see darkPalette in theme.ts)
    colorPairLR: toRgb(palette.alignmentFill.pairLR),
    colorPairRL: toRgb(palette.alignmentFill.pairRL),
    colorPairRR: toRgb(palette.alignmentFill.pairRR),
    colorPairLL: toRgb(palette.alignmentFill.pairLL),
    colorBaseA: toRgb(palette.bases.A.main),
    colorBaseC: toRgb(palette.bases.C.main),
    colorBaseG: toRgb(palette.bases.G.main),
    colorBaseT: toRgb(palette.bases.T.main),
    colorBaseN: toRgb(palette.bases.N.main),
    colorInsertion,
    colorDeletion: toRgb(palette.deletion),
    colorSkip: toRgb(palette.skip),
    colorSoftclip,
    colorHardclip,
    colorInsertionIndicator: lighten(colorInsertion, indicatorLighten),
    colorSoftclipIndicator: lighten(colorSoftclip, indicatorLighten),
    colorHardclipIndicator: lighten(colorHardclip, indicatorLighten),
    colorCoverage: toRgb(palette.coverage),
    colorModificationFwd: toRgb(palette.modificationFwd),
    colorModificationRev: toRgb(palette.modificationRev),
    colorMutedSnpBase: toRgb(palette.mutedSnpBase),
    colorLongInsert: toRgb(colorLongInsert),
    colorShortInsert: toRgb(colorShortInsert),
    colorSupplementary: toRgb(colorSupplementary),
    colorUnmappedMate: toRgb(colorUnmappedMate),
    colorInterchrom: toRgb(colorInterchrom),
  }
}

export function canvasToGenomicCoords(
  canvasY: number,
  genomicPos: number,
  bpPerPx: number,
  featureHeight: number,
  featureSpacing: number,
  topOffset: number,
  scrollTop: number,
): CigarCoords {
  const rowHeight = featureHeight + featureSpacing
  const adjustedY = canvasY + scrollTop - topOffset
  const row = Math.floor(adjustedY / rowHeight)
  const yWithinRow = adjustedY - row * rowHeight
  return { bpPerPx, genomicPos, row, adjustedY, yWithinRow }
}

export function getCanvasCoords(
  e: React.MouseEvent,
  canvas: HTMLCanvasElement | null,
  canvasRectRef: React.RefObject<{ rect: DOMRect; timestamp: number } | null>,
) {
  if (!canvas) {
    return undefined
  }

  const now = Date.now()
  const cached = canvasRectRef.current

  if (cached && now - cached.timestamp < 100) {
    return {
      canvasX: e.clientX - cached.rect.left,
      canvasY: e.clientY - cached.rect.top,
    }
  }

  const rect = canvas.getBoundingClientRect()
  canvasRectRef.current = { rect, timestamp: now }
  return { canvasX: e.clientX - rect.left, canvasY: e.clientY - rect.top }
}

export const CIGAR_TYPE_LABELS: Record<string, string> = {
  mismatch: 'SNP/Mismatch',
  insertion: 'Insertion',
  deletion: 'Deletion',
  skip: 'Skip (Intron)',
  softclip: 'Soft Clip',
  hardclip: 'Hard Clip',
}

// Pan-or-click threshold (|dx|+|dy|, CSS px).
export const CLICK_SUPPRESS_THRESHOLD_PX = 4

// Ref to a shared AbortController, auto-aborted on unmount so that a
// removed component leaves no dangling document mousemove/mouseup
// listeners referencing destroyed models.
export function useAbortableRef() {
  const ref = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      ref.current?.abort()
    },
    [],
  )
  return ref
}

// True iff the shared controller has an active drag. Used to suppress
// canvas hover updates during any drag without a parallel "isDragging"
// flag — the AbortController IS the source of truth (mouseup aborts it).
export function isDragInProgress(
  controllerRef: React.RefObject<AbortController | null>,
) {
  const ac = controllerRef.current
  return ac !== null && !ac.signal.aborted
}

// Starts a document-level drag: cancels any in-progress drag on the shared
// controllerRef, listens to document mousemove/mouseup, and forwards each
// delta from the original mousedown position to `onMove`. The shared ref
// ensures opening a new drag while one is active cleanly tears down the old
// listeners — no orphan document handlers, no double-fire. Using document
// listeners (vs React canvas events) means the drag continues when the
// cursor leaves the source element, with no "isDragging" flag needed.
//
// stopPropagation keeps the mousedown from also reaching the view's own
// click-drag pan handler (would double-pan). We deliberately do NOT
// preventDefault the mousedown: that cancels its native focus shift and leaves
// a focused popup (e.g. the location-search Autocomplete, which only closes on
// blur) stuck open. Text selection is suppressed per-move instead — the same
// approach as the LGV's useSideScroll.
export function startDocumentDrag(
  e: React.MouseEvent,
  controllerRef: React.RefObject<AbortController | null>,
  onMove: (dx: number, dy: number) => void,
) {
  e.stopPropagation()
  controllerRef.current?.abort()
  const ac = new AbortController()
  controllerRef.current = ac
  const startX = e.clientX
  const startY = e.clientY
  document.addEventListener(
    'mousemove',
    me => {
      me.preventDefault()
      onMove(me.clientX - startX, me.clientY - startY)
    },
    { signal: ac.signal },
  )
  document.addEventListener(
    'mouseup',
    () => {
      ac.abort()
    },
    { signal: ac.signal },
  )
}
