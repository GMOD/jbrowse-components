import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { rowsUnderPointer } from '@jbrowse/core/util/rowStackGeometry'
import { treeSidebarRightEdge } from '@jbrowse/tree-sidebar'

import { blockScreenRect } from './rendering/blockScreenRect.ts'
import { regionWithDeltas } from './rendering/featurePainting.ts'
import { paintedSpanContainsBp, rowBand } from './rendering/rowBand.ts'

import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource } from './rowSources.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface MultiRowHit {
  id: string
  regionIndex: number
  // The row's identity, not its position: a hit outlives a reorder, a subtree
  // filter or a clustering run, so consumers resolve the row through
  // `rowIndexByValue`.
  rowName: string
  name: string
  refName: string
  start: number
  end: number
  // Signed bp length change vs the reference, absent whenever the `lengthField`
  // slot is unset. The block's width is reference span and says nothing about
  // it.
  delta?: number
}

export interface MultiRowContextMenuInfo extends ContextMenuAnchor {
  refName: string
  pos: number
  hit?: MultiRowHit
}

interface HitTestView {
  bpPerPx: number
  pxToBp: (px: number) => {
    refName: string
    start: number
    end: number
    reversed?: boolean
    oob: boolean
    offset: number
    index: number
  }
}

/**
 * Callers pass `self` straight in so MobX tracks exactly what each function
 * below reads; building an argument object instead would make
 * `highlightedBlockRect` depend on the whole encoded map.
 */
export interface MultiRowHitTestSlice {
  showTree: boolean
  hierarchy?: unknown
  treeAreaWidth: number
  sources: MultiRowSource[]
  rowIndexByValue: ReadonlyMap<string, number>
  effectiveRowHeight: number
  rowProportion: number
  renderBlocks: RenderBlock[]
  drawnRegionData: ReadonlyMap<number, MultiRowRegionData>
  encodedChannels: ReadonlyMap<number, MultiRowEncoded>
  view: HitTestView
}

type PointerBase = ReturnType<HitTestView['pxToBp']>

/**
 * The view's answer for a display-relative pixel, undefined over the tree
 * sidebar and in the inter-region gutter. The bound is `treeSidebarRightEdge`,
 * not `sidebarOffset`: the resize handle sits in the 4px past the latter, and a
 * hit under the handle would fight the drag.
 */
function pointerBase(self: MultiRowHitTestSlice, mouseX: number) {
  if (mouseX < treeSidebarRightEdge(self)) {
    return undefined
  }
  const p = self.view.pxToBp(mouseX)
  return p.oob ? undefined : p
}

/**
 * `rowsUnderPointer` asks at the pixel's centre, the scanline that decided the
 * color under the cursor — at the 0.32 px rows a cohort painting fits into, the
 * top edge names a row one and a half off. Several sub-pixel rows share one
 * drawn pixel, so the walk from `nearest` to `lowest` finds whichever of them
 * actually put a block there. Each row's bucket is walked back to front, since
 * both render paths paint in array order and a later channel sits on top.
 */
function featureAtBase(
  self: MultiRowHitTestSlice,
  p: PointerBase,
  mouseY: number,
): MultiRowHit | undefined {
  const { view } = self
  const region = self.drawnRegionData.get(p.index)
  const encoded = self.encodedChannels.get(p.index)
  if (!region || !encoded) {
    return undefined
  }
  // coord0 names the base to the right of the cursor when reversed.
  const bp = basePaintedAt(p, p.offset)
  const { featureStarts, featureEnds, featureNames, featureIds } = region
  const { x, x2, rowStart, rowIndices, featureIndex } = encoded
  const deltas = regionWithDeltas(region)?.featureDeltas
  const rowHeight = self.effectiveRowHeight
  const { nearest, lowest } = rowsUnderPointer(
    mouseY,
    { rowHeight },
    rowBand(rowHeight, self.rowProportion).height,
  )
  for (let targetRow = nearest; targetRow >= lowest; targetRow--) {
    const row = self.sources[targetRow]
    const lo = rowStart[targetRow]
    const hi = rowStart[targetRow + 1]
    if (row && lo !== undefined && hi !== undefined) {
      for (let k = hi - 1; k >= lo; k--) {
        const c = rowIndices[k]!
        if (paintedSpanContainsBp(x[c]!, x2[c]!, bp, view.bpPerPx)) {
          const i = featureIndex[c]!
          return {
            id: featureIds[i]!,
            regionIndex: p.index,
            rowName: row.name,
            name: featureNames[i]!,
            refName: p.refName,
            start: featureStarts[i]!,
            end: featureEnds[i]!,
            delta: deltas?.[i],
          }
        }
      }
    }
  }
  return undefined
}

/** The feature under a display-relative pixel, or undefined where none is. */
export function featureAtPixel(
  self: MultiRowHitTestSlice,
  mouseX: number,
  mouseY: number,
): MultiRowHit | undefined {
  const p = pointerBase(self, mouseX)
  return p && featureAtBase(self, p, mouseY)
}

/**
 * What a right-click resolves to, and undefined wherever no menu should open,
 * which is what the component decides whether to `preventDefault` on.
 */
export function contextTargetAtPixel(
  self: MultiRowHitTestSlice,
  mouseX: number,
  mouseY: number,
) {
  const p = pointerBase(self, mouseX)
  return (
    p && {
      refName: p.refName,
      // The base drawn at the clicked column; coord0 is off by one when
      // reversed.
      pos: basePaintedAt(p, p.offset),
      hit: featureAtBase(self, p, mouseY),
    }
  )
}

/**
 * The row is resolved off the live order rather than trusted from the hit, so a
 * row since filtered away draws no box.
 */
export function hitBlockRect(
  self: Pick<
    MultiRowHitTestSlice,
    'rowIndexByValue' | 'renderBlocks' | 'effectiveRowHeight' | 'rowProportion'
  >,
  hit: MultiRowHit | undefined,
) {
  const rowIndex = hit && self.rowIndexByValue.get(hit.rowName)
  return hit && rowIndex !== undefined
    ? blockScreenRect({
        hit,
        rowIndex,
        blocks: self.renderBlocks,
        rowHeight: self.effectiveRowHeight,
        rowProportion: self.rowProportion,
      })
    : undefined
}

export function hitRow(
  self: Pick<MultiRowHitTestSlice, 'rowIndexByValue' | 'sources'>,
  hit: MultiRowHit | undefined,
) {
  const rowIndex = hit && self.rowIndexByValue.get(hit.rowName)
  return rowIndex === undefined ? undefined : self.sources[rowIndex]
}
