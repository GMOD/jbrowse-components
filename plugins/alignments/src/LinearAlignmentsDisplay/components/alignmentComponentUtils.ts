import { useEffect, useRef } from 'react'
import type React from 'react'

import { fillColor } from '../../shared/color.ts'
import { toRgb } from '../shaders/colors.ts'

import type { CigarCoords } from '../../shared/hitTestTypes.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Theme } from '@mui/material'

export function makeBpToScreenX(view: LinearGenomeViewModel) {
  const { offsetPx } = view
  return (refName: string, bp: number) => {
    const r = view.bpToPx({ refName, coord: bp })
    return r === undefined ? undefined : r.offsetPx - offsetPx
  }
}

export function buildColorPaletteFromTheme(theme: Theme): ColorPalette {
  const { palette } = theme
  return {
    colorFwdStrand: toRgb(fillColor.color_fwd_strand),
    colorRevStrand: toRgb(fillColor.color_rev_strand),
    colorNostrand: toRgb(fillColor.color_nostrand),
    colorPairLR: toRgb(fillColor.color_pair_lr),
    colorPairRL: toRgb(fillColor.color_pair_rl),
    colorPairRR: toRgb(fillColor.color_pair_rr),
    colorPairLL: toRgb(fillColor.color_pair_ll),
    colorBaseA: toRgb(palette.bases.A.main),
    colorBaseC: toRgb(palette.bases.C.main),
    colorBaseG: toRgb(palette.bases.G.main),
    colorBaseT: toRgb(palette.bases.T.main),
    colorInsertion: toRgb(palette.insertion),
    colorDeletion: toRgb(palette.deletion),
    colorSkip: toRgb(palette.skip),
    colorSoftclip: toRgb(palette.softclip),
    colorHardclip: toRgb(palette.hardclip),
    colorCoverage: toRgb(palette.coverage),
    colorModificationFwd: toRgb(palette.modificationFwd),
    colorModificationRev: toRgb(palette.modificationRev),
    colorMutedSnpBase: toRgb(palette.mutedSnpBase),
    colorLongInsert: toRgb(fillColor.color_longinsert),
    colorShortInsert: toRgb(fillColor.color_shortinsert),
    colorSupplementary: toRgb(fillColor.color_supplementary),
    colorUnmappedMate: toRgb(fillColor.color_unmapped_mate),
  }
}

export function canvasToGenomicCoords(
  canvasY: number,
  genomicPos: number,
  bpPerPx: number,
  featureHeight: number,
  featureSpacing: number,
  topOffset: number,
  rangeY: [number, number],
): CigarCoords {
  const rowHeight = featureHeight + featureSpacing
  const adjustedY = canvasY + rangeY[0] - topOffset
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
export function startDocumentDrag(
  e: React.MouseEvent,
  controllerRef: React.RefObject<AbortController | null>,
  onMove: (dx: number, dy: number) => void,
) {
  e.preventDefault()
  e.stopPropagation()
  controllerRef.current?.abort()
  const ac = new AbortController()
  controllerRef.current = ac
  const startX = e.clientX
  const startY = e.clientY
  document.addEventListener(
    'mousemove',
    me => {
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
