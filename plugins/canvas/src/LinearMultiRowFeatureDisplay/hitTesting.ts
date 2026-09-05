import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import {
  contentYAt,
  rowsUnderPointer,
} from '@jbrowse/core/util/rowStackGeometry'
import { treeSidebarRightEdge } from '@jbrowse/tree-sidebar'

import { blockScreenRect } from './rendering/blockScreenRect.ts'
import { regionWithDeltas } from './rendering/featurePainting.ts'
import { MULTI_ROW_MARK } from './rendering/multiRowMarks.ts'
import { rowBand } from './rendering/rowBand.ts'

import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './rendering/multiRowRenderingBackendTypes.ts'
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
  renderState: MultiRowRenderState
  drawnRegionData: ReadonlyMap<number, MultiRowRegionData>
  encodedChannels: ReadonlyMap<number, MultiRowEncoded>
  view: HitTestView
}

type PointerBase = ReturnType<HitTestView['pxToBp']>

// Containment, not proximity: the bound admits distance 0 and nothing else.
const INSIDE_ONLY = Number.MIN_VALUE

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
 * The channel indices drawn on rows `nearest` down to `lowest`, each row's
 * bucket back to front: both render paths paint in array order, so a later
 * channel sits on top, and the mark keeps the first zero-distance candidate.
 */
function* channelsOnRows(
  { rowStart, rowIndices }: MultiRowEncoded,
  nearest: number,
  lowest: number,
) {
  for (let r = nearest; r >= lowest; r--) {
    const lo = rowStart[r]
    const hi = rowStart[r + 1]
    if (lo !== undefined && hi !== undefined) {
      for (let k = hi - 1; k >= lo; k--) {
        yield rowIndices[k]!
      }
    }
  }
}

/**
 * `rowsUnderPointer` asks at the pixel's centre, the scanline that decided the
 * color under the cursor — at the 0.32 px rows a cohort painting fits into, the
 * top edge names a row one and a half off. Several sub-pixel rows share one
 * drawn pixel, so the walk from `nearest` to `lowest` finds whichever of them
 * actually put a block there. The mark then answers which of those rows'
 * blocks the pixel's centre is on.
 */
function featureAtBase(
  self: MultiRowHitTestSlice,
  p: PointerBase,
  mouseX: number,
  mouseY: number,
): MultiRowHit | undefined {
  const region = self.drawnRegionData.get(p.index)
  const encoded = self.encodedChannels.get(p.index)
  const block = self.renderBlocks.find(b => b.displayedRegionIndex === p.index)
  if (!region || !encoded || !block) {
    return undefined
  }
  const rowHeight = self.effectiveRowHeight
  const stack = { rowHeight }
  const { nearest, lowest } = rowsUnderPointer(
    mouseY,
    stack,
    rowBand(rowHeight, self.rowProportion).height,
  )
  const hit = MULTI_ROW_MARK.hitNearest?.(
    encoded,
    block,
    self.renderState,
    Math.floor(mouseX) + 0.5,
    contentYAt(mouseY, stack),
    channelsOnRows(encoded, nearest, lowest),
    INSIDE_ONLY,
  )
  if (!hit) {
    return undefined
  }
  const row = self.sources[encoded.row[hit.index]!]
  if (!row) {
    return undefined
  }
  const i = encoded.featureIndex[hit.index]!
  return {
    id: region.featureIds[i]!,
    regionIndex: p.index,
    rowName: row.name,
    name: region.featureNames[i]!,
    refName: p.refName,
    start: region.featureStarts[i]!,
    end: region.featureEnds[i]!,
    delta: regionWithDeltas(region)?.featureDeltas[i],
  }
}

/** The feature under a display-relative pixel, or undefined where none is. */
export function featureAtPixel(
  self: MultiRowHitTestSlice,
  mouseX: number,
  mouseY: number,
): MultiRowHit | undefined {
  const p = pointerBase(self, mouseX)
  return p && featureAtBase(self, p, mouseX, mouseY)
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
      hit: featureAtBase(self, p, mouseX, mouseY),
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

/** The row a hit sits on, off the live order — resolved the way the box is. */
export function hitRow(
  self: Pick<MultiRowHitTestSlice, 'rowIndexByValue' | 'sources'>,
  hit: MultiRowHit | undefined,
) {
  const rowIndex = hit && self.rowIndexByValue.get(hit.rowName)
  return rowIndex === undefined ? undefined : self.sources[rowIndex]
}
