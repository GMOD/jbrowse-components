import { colord } from '@jbrowse/core/util/colord'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Theme } from '@mui/material'

// User-supplied color is used as-is so explicit alpha is preserved; otherwise
// fall back to the theme highlight color at a standard alpha. Shared between
// the main-view and overview highlight bands.
export function getHighlightColor(highlight: { color?: string }, theme: Theme) {
  return highlight.color
    ? colord(highlight.color)
    : colord(theme.palette.highlight.main).alpha(0.35)
}

// Shared style for elided (collapsed) blocks — striped grey pattern used
// consistently across OverviewScalebar, ScalebarCoordinateLabels, and Gridlines
export const elidedBlockStyles = {
  backgroundColor: '#999',
  backgroundImage:
    'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
} as const

export function getCytobands(assembly: Assembly | undefined, refName: string) {
  return (
    assembly?.cytobands
      ?.map(f => ({
        refName:
          assembly.getCanonicalRefName(f.get('refName')) || f.get('refName'),
        start: f.get('start'),
        end: f.get('end'),
        type: f.get('gieStain') as string,
        name: f.get('name'),
      }))
      .filter(f => f.refName === refName) ?? []
  )
}

const MIN_DRAG_DISTANCE = 30

export function shouldSwapTracks(
  lastSwapY: number | undefined,
  currentY: number,
  movingDown: boolean,
) {
  return (
    lastSwapY === undefined ||
    (movingDown && currentY > lastSwapY + MIN_DRAG_DISTANCE) ||
    (!movingDown && currentY < lastSwapY - MIN_DRAG_DISTANCE)
  )
}
