import { useEffect, useRef } from 'react'

import {
  colorFwdStrand,
  colorInterchrom,
  colorLongInsert,
  colorNostrand,
  colorRevStrand,
  colorShortInsert,
  colorSplitReadInversion,
  colorSupplementary,
  colorUnmappedMate,
} from '@jbrowse/core/ui/theme'

import { toRgb } from '../shaders/colors.ts'

import type { CigarCoords } from '../../shared/hitTestTypes.ts'
import type { ColorPalette, RGBColor } from '../shaders/colors.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

// `bpToPx` matches a region on refName AND coordinate containment, so disjoint
// windows on one chromosome (collapsed introns, two loci on one chrom) already
// disambiguate themselves. OVERLAPPING ones do not: two displayed regions whose
// coordinate ranges intersect — a foldback laid out in derivative order, where
// the same arm appears twice — both contain the endpoint, and the first always
// wins. The connector for the second copy then lands back on the first, drawing
// a zero-length arc where the interesting junction was.
//
// So `displayedRegionIndex` is a preference, not a constraint: pinning it picks
// the right copy when several match, and falling back to the plain lookup keeps
// an endpoint that spills past its own region's edge (reads are fetched by
// overlap, so a read's far end can sit outside the region that returned it)
// resolving exactly as it does today.
export function makeBpToScreenX(view: LinearGenomeViewModel) {
  const { offsetPx } = view
  return (refName: string, bp: number, displayedRegionIndex?: number) => {
    const r =
      (displayedRegionIndex === undefined
        ? undefined
        : view.bpToPx({ refName, coord: bp, displayedRegionIndex })) ??
      view.bpToPx({ refName, coord: bp })
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

export function buildColorPaletteFromPalette(
  palette: JBrowsePalette,
): ColorPalette {
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
    colorSplitInversion: toRgb(colorSplitReadInversion),
    colorUnmappedMate: toRgb(colorUnmappedMate),
    colorInterchrom: toRgb(colorInterchrom),
  }
}

// Everything a per-feature hit test reads about where the cursor is: the two bp
// forms (see CigarCoords) plus the pileup row the Y lands in. An object rather
// than eight positional numbers, none of which the compiler could tell apart.
export function canvasToGenomicCoords({
  canvasY,
  genomicPos,
  basePos,
  bpPerPx,
  featureHeight,
  featureSpacing,
  topOffset,
  scrollTop,
}: {
  canvasY: number
  genomicPos: number
  basePos: number
  bpPerPx: number
  featureHeight: number
  featureSpacing: number
  topOffset: number
  scrollTop: number
}): CigarCoords {
  const rowHeight = featureHeight + featureSpacing
  const adjustedY = canvasY + scrollTop - topOffset
  const row = Math.floor(adjustedY / rowHeight)
  const yWithinRow = adjustedY - row * rowHeight
  return { bpPerPx, genomicPos, basePos, row, adjustedY, yWithinRow }
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
