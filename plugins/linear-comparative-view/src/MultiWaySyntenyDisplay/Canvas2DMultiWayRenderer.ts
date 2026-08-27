import { CANVAS_GLYPH_DRAW } from '@jbrowse/plugin-canvas'
import { getDpr, prepareCanvas } from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import { drawSyntenyTrack } from '../LinearSyntenyDisplay/Canvas2DSyntenyRenderer.ts'
import { SyntenyGeometryCache } from '../LinearSyntenyDisplay/syntenyGeometryCache.ts'
import {
  makePickCtx,
  pickFeatureAtPoint,
} from '../LinearSyntenyDisplay/syntenyPickEngine.ts'
import { glyphRangeStart, ribbonParams } from './multiwayRenderTypes.ts'

import type { PickCanvasLike } from '../LinearSyntenyDisplay/syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type {
  GlyphLayer,
  LaneGlyphData,
  MultiWayCell,
  MultiWayRenderState,
  MultiWayRenderingBackend,
  MultiWayRibbonPick,
} from './multiwayRenderTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { BlockClip } from '@jbrowse/render-core/canvas2dUtils'

// the glyph painters take a block and a clip for the per-region display's
// scissoring and continuation marks; a lane is one unclipped band
const WHOLE_BAND: BlockClip = {
  scissorX: 0,
  scissorW: 0,
  fullBlockWidth: 0,
  bpLength: 0,
}

function drawGlyphLayer(
  ctx: Ctx2D,
  data: LaneGlyphData,
  layer: GlyphLayer,
  state: MultiWayRenderState,
) {
  const start = glyphRangeStart(layer, state)
  const toX = (px: number) => px - start
  const block = {
    start: 0,
    end: state.width,
    screenStartPx: 0,
    screenEndPx: state.width,
    reversed: false,
  }
  const frame = {
    scrollY: 0,
    canvasWidth: state.width,
    canvasHeight: state.height,
  }
  for (const id of ['line', 'rect', 'arrow'] as const) {
    CANVAS_GLYPH_DRAW[id](ctx, data, block, toX, frame, WHOLE_BAND)
  }
}

/**
 * The whole stack, back to front, in logical px. The interactive backend, the
 * SVG export and a test's recording context all draw through this one
 * function, which is what keeps the three from describing different pictures.
 */
export function drawMultiWay(
  ctx: Ctx2D,
  cells: ReadonlyMap<string, MultiWayCell>,
  state: MultiWayRenderState,
) {
  for (const layer of state.layers) {
    const cell = cells.get(layer.key)
    if (!cell) {
      continue
    }
    if (layer.kind === 'ribbons' && cell.kind === 'ribbons') {
      drawSyntenyTrack(
        ctx,
        cell.data,
        ribbonParams(layer, state),
        state.width,
        0,
      )
    } else if (layer.kind === 'glyphs' && cell.kind === 'glyphs') {
      drawGlyphLayer(ctx, cell.data, layer, state)
    }
  }
}

/**
 * The ribbon layers as the pick engine reads them: a numeric key per layer,
 * topmost last, so a point over two gutters answers the one drawn over.
 */
export function ribbonPickState(
  state: MultiWayRenderState,
  keyOf: (key: string) => number,
): SyntenyRenderState {
  const perTrack = new Map<number, SyntenyTrackRenderParams>()
  for (const layer of state.layers) {
    if (layer.kind === 'ribbons') {
      perTrack.set(keyOf(layer.key), ribbonParams(layer, state))
    }
  }
  return { overdrawPx: 0, perTrack }
}

/**
 * Stable numeric ids for the string cell keys, which the HAL, the pick engine
 * and the geometry cache all key on.
 */
export class CellIds {
  private ids = new Map<string, number>()
  private names = new Map<number, string>()

  of(key: string) {
    let id = this.ids.get(key)
    if (id === undefined) {
      id = this.ids.size + 1
      this.ids.set(key, id)
      this.names.set(id, key)
    }
    return id
  }

  name(id: number) {
    return this.names.get(id)
  }
}

export function ribbonPickResult(
  hit: { key: number; instanceIndex: number } | undefined,
  ids: CellIds,
  regions: Map<number, SyntenyInstanceData>,
): MultiWayRibbonPick | undefined {
  if (!hit) {
    return undefined
  }
  const key = ids.name(hit.key)
  const data = regions.get(hit.key)
  return key === undefined || !data
    ? undefined
    : {
        key,
        instanceIndex: hit.instanceIndex,
        targetIdx: data.instanceFeatureIdx[hit.instanceIndex]!,
      }
}

export class Canvas2DMultiWayRenderer
  extends Canvas2DRenderingBackendBase
  implements MultiWayRenderingBackend
{
  private cells = new Map<string, MultiWayCell>()
  private ids = new CellIds()
  private ribbons = new SyntenyGeometryCache()
  private pickCtx: PickCanvasLike | undefined

  resize(width: number, height: number) {
    prepareCanvas(this.canvas, this.ctx, width, height)
  }

  upload(key: string, cell: MultiWayCell) {
    this.cells.set(key, cell)
    if (cell.kind === 'ribbons') {
      this.ribbons.set(this.ids.of(key), cell.data)
    }
  }

  release(key: string) {
    this.cells.delete(key)
    this.ribbons.delete(this.ids.of(key))
  }

  render(state: MultiWayRenderState) {
    prepareCanvas(this.canvas, this.ctx, state.width, state.height)
    drawMultiWay(this.ctx, this.cells, state)
    return true
  }

  pickRibbon(x: number, y: number, state: MultiWayRenderState) {
    this.pickCtx ??= makePickCtx()
    const ctx = this.pickCtx
    if (!ctx) {
      return undefined
    }
    return ribbonPickResult(
      pickFeatureAtPoint({
        ctx,
        state: ribbonPickState(state, key => this.ids.of(key)),
        regions: this.ribbons.regions,
        pickIndices: this.ribbons.pickIndices,
        canvasLogicalWidth: this.canvas.width / getDpr(),
        x,
        y,
      }),
      this.ids,
      this.ribbons.regions,
    )
  }

  dispose() {
    this.cells.clear()
    this.ribbons.clear()
  }
}
