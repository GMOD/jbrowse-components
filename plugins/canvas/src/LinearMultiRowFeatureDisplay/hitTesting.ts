import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import {
  contentYAt,
  rowsUnderPointer,
} from '@jbrowse/core/util/rowStackGeometry'
import { bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'
import { spansInRow } from '@jbrowse/render-core/marks'
import { MULTI_ROW_MIN_CELL_PX } from '@jbrowse/render-core/shaders/rowRectConsts'
import { treeSidebarRightEdge } from '@jbrowse/tree-sidebar'

import { featureRun } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import {
  MULTI_ROW_BLOCK_MARK,
  MULTI_ROW_MARK,
} from './rendering/multiRowMarks.ts'
import { rowBand } from './rendering/rowBand.ts'

import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'
import type { MarkInstance, RowKeys } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { RowSource } from '@jbrowse/tree-sidebar'

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
 * below reads; building an argument object instead would make `hoverInk`
 * depend on the whole channel map.
 */
export interface MultiRowHitTestSlice {
  showTree: boolean
  hierarchy?: unknown
  treeAreaWidth: number
  sources: RowSource[]
  rowIndexByValue: ReadonlyMap<string, number>
  rowKeys: RowKeys
  effectiveRowHeight: number
  rowProportion: number
  renderBlocks: RenderBlock[]
  renderState: MultiRowRenderState
  rpcDataMap: ReadonlyMap<number, MultiRowRegionData>
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

const drawnLastFirst = (a: number, b: number) => b - a

/** The keys of rows `nearest` down to `lowest`, skipping rows with none. */
function rowKeysUnder(
  self: Pick<MultiRowHitTestSlice, 'sources' | 'rowKeys'>,
  nearest: number,
  lowest: number,
) {
  const keys: number[] = []
  for (let r = nearest; r >= lowest; r--) {
    const name = self.sources[r]?.name
    const key = name === undefined ? undefined : self.rowKeys.lookup(name)
    if (key !== undefined) {
      keys.push(key)
    }
  }
  return keys
}

/**
 * The channel indices drawn on `keys` within reach of `xPx`, each row's back
 * to front: both render paths paint in array order, so a later channel sits on
 * top, and the mark keeps the first zero-distance candidate. The reach is the
 * minimum cell and a pixel either side, the most a span's paint stands past
 * its bp.
 */
function channelsOnRows(
  { rowIndex, x, x2 }: MultiRowEncoded,
  block: RenderBlock,
  xPx: number,
  keys: readonly number[],
) {
  const reachBp =
    ((MULTI_ROW_MIN_CELL_PX + 1) * (block.end - block.start)) /
    (block.screenEndPx - block.screenStartPx)
  const bp = bpAtPxExact(xPx, block)
  const out: number[] = []
  for (const key of keys) {
    const found: number[] = []
    spansInRow(rowIndex, x, x2, key, bp - reachBp, bp + reachBp, found)
    out.push(...found.sort(drawnLastFirst))
  }
  return out
}

/** The intron line on one of `keys` over `bp`, as its row key and feature. */
function intronAt(
  { x, x2, row, featureIndex, count }: MultiRowEncoded['introns'],
  keys: readonly number[],
  bp: number,
) {
  for (let c = 0; c < count; c++) {
    if (x[c]! <= bp && bp < x2[c]! && keys.includes(row[c]!)) {
      return { key: row[c]!, i: featureIndex[c]! }
    }
  }
  return undefined
}

/**
 * `rowsUnderPointer` asks at the pixel's centre, the scanline that decided the
 * color under the cursor — at the 0.32 px rows a cohort painting fits into, the
 * top edge names a row one and a half off. Several sub-pixel rows share one
 * drawn pixel, so the walk from `nearest` to `lowest` finds whichever of them
 * actually put a block there; the span mark answers which of those rows'
 * blocks the pixel's centre is on.
 *
 * The row window is asked in band space because `rowProportion` insets each
 * band inside its slot; `yPx` stays slot-relative, the space `spanMark`
 * measures in.
 */
function featureAtBase(
  self: MultiRowHitTestSlice,
  p: PointerBase,
  mouseX: number,
  mouseY: number,
): MultiRowHit | undefined {
  const region = self.rpcDataMap.get(p.index)
  const channels = self.encodedChannels.get(p.index)
  const block = self.renderBlocks.find(b => b.displayedRegionIndex === p.index)
  if (!region || !channels || !block) {
    return undefined
  }
  const rowHeight = self.effectiveRowHeight
  const band = rowBand(rowHeight, self.rowProportion)
  const { nearest, lowest } = rowsUnderPointer(
    mouseY,
    { rowHeight, topOffset: band.offset },
    band.height,
  )
  const xPx = Math.floor(mouseX) + 0.5
  const yPx = contentYAt(mouseY, { rowHeight })
  const keys = rowKeysUnder(self, nearest, lowest)
  const c = MULTI_ROW_MARK.hitNearest?.(
    channels,
    block,
    self.renderState,
    xPx,
    yPx,
    channelsOnRows(channels, block, xPx, keys),
    INSIDE_ONLY,
  )?.index
  const found =
    c === undefined
      ? intronAt(channels.introns, keys, bpAtPxExact(xPx, block))
      : { key: channels.row[c]!, i: channels.featureIndex[c]! }
  const rowName = found && self.rowKeys.names[found.key]
  if (!found || rowName === undefined) {
    return undefined
  }
  const [first, last] = featureRun(region.featureIds, found.i)
  const { i } = found
  return {
    id: region.featureIds[i]!,
    regionIndex: p.index,
    rowName,
    name: region.featureNames[i]!,
    refName: p.refName,
    start: region.featureStarts[first]!,
    end: region.featureEnds[last]!,
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
 * What a right-click resolves to, and undefined wherever no menu should open.
 * The component decides from this whether to call `preventDefault`.
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
 * The blocks a hit's feature draws in the live encoding, resolved by row name
 * and feature id rather than trusted from the hit, so a row since filtered
 * away lights nothing.
 */
export function hitInstances(
  self: Pick<
    MultiRowHitTestSlice,
    'rowIndexByValue' | 'rowKeys' | 'rpcDataMap' | 'encodedChannels'
  >,
  hit: MultiRowHit | undefined,
): MarkInstance[] {
  const region = hit && self.rpcDataMap.get(hit.regionIndex)
  const channels = hit && self.encodedChannels.get(hit.regionIndex)
  if (!region || !channels || !self.rowIndexByValue.has(hit.rowName)) {
    return []
  }
  const key = self.rowKeys.lookup(hit.rowName)
  const found: number[] = []
  if (key !== undefined) {
    spansInRow(
      channels.rowIndex,
      channels.x,
      channels.x2,
      key,
      0,
      Infinity,
      found,
    )
  }
  return found
    .filter(c => region.featureIds[channels.featureIndex[c]!] === hit.id)
    .map(index => ({ mark: MULTI_ROW_BLOCK_MARK, index }))
}

/** The row a hit sits on, off the live order — resolved the way the box is. */
export function hitRow(
  self: Pick<MultiRowHitTestSlice, 'rowIndexByValue' | 'sources'>,
  hit: MultiRowHit | undefined,
) {
  const rowIndex = hit && self.rowIndexByValue.get(hit.rowName)
  return rowIndex === undefined ? undefined : self.sources[rowIndex]
}
