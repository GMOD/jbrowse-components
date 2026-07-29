import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

// getHighlightColor/highlightKey live in core so the dotplot highlight bands can
// share the exact same color and React-key semantics
export { getHighlightColor, highlightKey } from '@jbrowse/core/util/highlights'

// Shared style for elided (collapsed) blocks — striped grey pattern used
// consistently across OverviewScalebar, ScalebarCoordinateLabels, and Gridlines
export const elidedBlockStyles = {
  backgroundColor: '#999',
  backgroundImage:
    'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
} as const

// The absolute-fill overlays (Gridlines, PaddingBlocks, ZoomTransform) are
// deliberately NOT consolidated onto a shared `position:absolute; inset:0`:
// they leave top/left unset so the box takes its static position, and pinning
// those to 0 moves the layer. On the inline-level Gridlines <svg> that shifted
// every tick off the canvas's grid (caught by the bsv-hg19-pileup snapshot).

export type Cytoband = ReturnType<typeof getCytobands>[number]

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
