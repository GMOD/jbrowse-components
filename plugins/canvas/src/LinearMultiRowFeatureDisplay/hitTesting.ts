import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { rowsUnderPointer } from '@jbrowse/core/util/rowStackGeometry'
import { treeSidebarRightEdge } from '@jbrowse/tree-sidebar'

import { blockScreenRect } from './rendering/blockScreenRect.ts'
import {
  drawnFeatureContext,
  drawnFeaturesByRow,
  findTopDrawnFeatureInRow,
  regionWithDeltas,
} from './rendering/featurePainting.ts'
import { paintedSpanContainsBp, rowBand } from './rendering/rowBand.ts'

import type { DrawnFeaturesByRow } from './rendering/featurePainting.ts'
import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource } from './rowSources.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface MultiRowHit {
  // adapter feature id + the region it was found in, so a click can re-fetch
  // the full feature for the details widget
  id: string
  regionIndex: number
  // the partition value naming the row the feature paints on — its IDENTITY,
  // not its position. A hit outlives a reorder, a subtree filter or a clustering
  // run, and a snapshotted index then names whoever moved into it. Consumers
  // resolve the row through `rowIndexByValue`.
  rowName: string
  name: string
  refName: string
  start: number
  end: number
  // Signed bp length change vs the reference, from the `lengthField` slot, and
  // absent whenever the slot is unset — the block's width is reference span and
  // says nothing about it, which is what the indel glyphs are for and what the
  // tooltip reads out.
  delta?: number
}

// What a right-click resolves to: the genomic column the menu's
// position-scoped rows act on, and the feature there when the click landed on
// one.
export interface MultiRowContextMenuInfo extends ContextMenuAnchor {
  refName: string
  pos: number
  hit?: MultiRowHit
}

// The view as the hit test reads it: the pixel-to-base map and the zoom the
// painters widened their sub-pixel cells at.
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
 * What "which feature is under this pixel" is asked of: the drawn rows and
 * their geometry, the drawn data and its per-row index, the sidebar the
 * painting starts to the right of, and the view.
 *
 * A structural slice rather than the display model, so every function below is
 * a plain call over values — and so that passing `self` straight in keeps MobX
 * tracking exactly what each one reads, which building an argument object here
 * would not (`highlightedBlockRect` would take a dependency on the whole hit
 * index).
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
  drawnFeaturesByRow: ReadonlyMap<number, DrawnFeaturesByRow>
  view: HitTestView
}

/**
 * Per-region drawn features bucketed by display row, held across calls.
 *
 * Held per region, because `rpcDataMap` invalidates the computed whole: the Nth
 * region to land rebuilt the N-1 indexes that already held, two passes over
 * every feature each. Kept on exactly the compares `installUpload` keeps its
 * encodings on, and exact for the same reason — a region payload is replaced
 * whole and never mutated (`regionDataMap`), and `featurePaintInputs` is the
 * memoized triple the painters key on. The row count is
 * `featurePaintInputs.rowIndexByValue.size`, so it cannot move without the
 * inputs identity moving with it.
 *
 * A factory rather than module state: one memo per display.
 */
export function createDrawnFeaturesByRowIndex() {
  const held = new Map<
    number,
    { data: MultiRowRegionData; byRow: DrawnFeaturesByRow }
  >()
  let heldFor: MultiRowFeaturePaintInputs | undefined
  return (
    regions: ReadonlyMap<number, MultiRowRegionData>,
    state: MultiRowFeaturePaintInputs,
    rowCount: number,
  ) => {
    if (state !== heldFor) {
      heldFor = state
      held.clear()
    }
    const byRegion = new Map<number, DrawnFeaturesByRow>()
    for (const [index, data] of regions.entries()) {
      const prev = held.get(index)
      const entry =
        prev?.data === data
          ? prev
          : {
              data,
              byRow: drawnFeaturesByRow(
                data,
                drawnFeatureContext(data, state),
                rowCount,
              ),
            }
      held.set(index, entry)
      byRegion.set(index, entry.byRow)
    }
    for (const index of held.keys()) {
      if (!byRegion.has(index)) {
        held.delete(index)
      }
    }
    return byRegion
  }
}

type PointerBase = ReturnType<HitTestView['pxToBp']>

/**
 * The view's answer for a display-relative pixel, or undefined where this
 * display answers nothing: over the tree sidebar, which overlays it and owns
 * its own menu, and in the inter-region gutter, where there is no base to name.
 *
 * The sidebar bound is `treeSidebarRightEdge`, not `sidebarOffset`: the latter
 * is where labels are *drawn* from, while the resize handle sitting in the 4px
 * past it is the sidebar's interactive edge, and a hit under the handle would
 * fight the drag. Same bound the wiggle family hit-tests against, and the same
 * one the crosshair's guide stops at.
 */
function pointerBase(self: MultiRowHitTestSlice, mouseX: number) {
  if (mouseX < treeSidebarRightEdge(self)) {
    return undefined
  }
  const p = self.view.pxToBp(mouseX)
  return p.oob ? undefined : p
}

/**
 * The feature at a resolved pointer base: the rows whose painted band covers
 * `mouseY`, then the first feature on one of those rows whose PAINTED block
 * covers the bp. Undefined off-row or over a gap.
 *
 * The row comes from `rowsUnderPointer`, the shared rule maf, variants and
 * wiggle read their stacks with, rather than `mouseY / rowHeight`. Two things
 * follow. The question is asked at the pixel's CENTRE, which is the scanline
 * that decided the colour the reader is pointing at — at the 0.32 px rows a
 * cohort painting fits into, the top edge names a row one and a half off. And
 * a sub-pixel row is painted at MIN_DRAWN_ROW_PX, so several rows share one
 * drawn pixel: the walk from `nearest` down to `lowest` finds whichever of them
 * actually put a block there, which is the block the reader can see.
 */
function featureAtBase(
  self: MultiRowHitTestSlice,
  p: PointerBase,
  mouseY: number,
): MultiRowHit | undefined {
  const { view } = self
  const region = self.drawnRegionData.get(p.index)
  if (!region) {
    return undefined
  }
  const byRow = self.drawnFeaturesByRow.get(p.index)
  if (!byRow) {
    return undefined
  }
  // the base drawn under the cursor, which the containment test compares
  // against; coord0 names the one to its right when reversed
  const bp = basePaintedAt(p, p.offset)
  const { featureStarts, featureEnds, featureNames, featureIds } = region
  const deltas = regionWithDeltas(region)?.featureDeltas
  const rowHeight = self.effectiveRowHeight
  const { nearest, lowest } = rowsUnderPointer(
    mouseY,
    { rowHeight },
    rowBand(rowHeight, self.rowProportion).height,
  )
  for (let targetRow = nearest; targetRow >= lowest; targetRow--) {
    const row = self.sources[targetRow]
    if (row) {
      // `findTopDrawnFeatureInRow` owns both halves of "which feature is under
      // this pixel" that the painters also own: which features are drawn at
      // all, and which of two overlapping ones is on top. All this adds is the
      // span, and `paintedSpanContainsBp` owns both the zero-length case and
      // the sub-pixel widening within that.
      const i = findTopDrawnFeatureInRow(byRow, targetRow, i =>
        paintedSpanContainsBp(
          featureStarts[i]!,
          featureEnds[i]!,
          bp,
          view.bpPerPx,
        ),
      )
      if (i !== -1) {
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
 * What a right-click at this display-relative pixel resolves to: the genomic
 * position the menu's position-scoped rows act on ("Sort rows by color here"),
 * and the feature there when the click landed on one.
 *
 * Undefined wherever no menu should open, which is what the component needs in
 * order to decide whether to `preventDefault`. Beside `featureAtPixel` because
 * it is the same question about the same pixel; spelled out in the component it
 * re-derived `pxToBp`, the sidebar bound and the painted base.
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
      // anchors "sort rows by color here" on the clicked column, so it must be
      // the base drawn there (coord0 is off by one when reversed)
      pos: basePaintedAt(p, p.offset),
      hit: featureAtBase(self, p, mouseY),
    }
  )
}

/**
 * Screen box of the block to mark, or undefined when there's nothing to mark.
 *
 * The row is resolved off the live order rather than trusted from the hit (see
 * `MultiRowHit.rowName`); a row since filtered away draws no box.
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
