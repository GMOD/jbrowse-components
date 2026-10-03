import { getContrastText } from '@jbrowse/core/ui/palette'
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import {
  bpProjection,
  forEachClippedBlock,
  projectBp,
  pxPerBpOf,
  strokeRectInside,
} from '@jbrowse/render-core/canvas2dUtils'
import {
  abgrToCssRgba,
  rowColor,
  rowSlot,
  rowTableKeys,
  rowTableTextures,
} from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import {
  insertionBarWidthPx,
  insertionMarkerDraws,
} from './insertionWidth.generated.ts'
import {
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  drawInsertionSerifs,
  getInsertionType,
  insertionSerifsWidthPx,
  labelFont,
} from './labelConstants.ts'
import {
  MIN_OUTLINED_PX,
  OUTLINE_ALPHA,
} from './shaders/insertionMark.consts.generated.ts'
import * as shader from './shaders/insertionMark.generated.ts'

import type { BpProjection } from '@jbrowse/render-core/canvas2dUtils'
import type {
  InkRect,
  MarkFrame,
  MarkShape,
  RowTable,
} from '@jbrowse/render-core/marks'
import type {
  BpRegionBounds,
  RenderBlock,
} from '@jbrowse/render-core/renderBlock'

/**
 * The `insertion` shape's channels: a marker centred on the midpoint of
 * `x[i]`..`x2[i]` (absolute bp; equal for an interbase insertion) on the band
 * of `row`, sized by `length` inserted bp, filled with packed ABGR `color`.
 * `under` is the packed colour of what each marker stands on, which a count
 * label reads against where the marker itself does not draw; absent, such a
 * marker draws no count.
 */
export interface InsertionChannels {
  x: Uint32Array
  x2: Uint32Array
  row: Uint32Array
  length: Uint32Array
  color: Uint32Array
  under?: Uint32Array
  count: number
}

export interface InsertionParams {
  /** CSS px per row. */
  rowHeight: number
  /** CSS px from the canvas top to row 0's band, less any scroll. */
  rowOffsetPx: number
  /** The band's height, which also decides whether a count fits. */
  bandHeightPx: number
  /**
   * The narrowest the reference span under a marker paints; a marker draws
   * only where it is wider. 0 for interbase insertions.
   */
  spanFloorPx: number
  /** A dark inner outline on markers at least `MIN_OUTLINED_PX` each way. */
  outline: boolean
  /** The table `row` is read through as a key; absent, `row` is the slot. */
  rowTable?: RowTable
}

export const EMPTY_INSERTIONS: InsertionChannels = {
  x: new Uint32Array(0),
  x2: new Uint32Array(0),
  row: new Uint32Array(0),
  length: new Uint32Array(0),
  color: new Uint32Array(0),
  count: 0,
}

const OUTLINE_CSS = `rgba(0,0,0,${OUTLINE_ALPHA})`

interface InsertionFrame extends BpProjection {
  pxPerBp: number
  params: InsertionParams
  drawn: boolean
  barWidth: number
  center: number
  top: number
}

function insertionFrame(
  block: BpRegionBounds,
  params: InsertionParams,
): InsertionFrame {
  return {
    ...bpProjection(block),
    pxPerBp: pxPerBpOf(block),
    params,
    drawn: false,
    barWidth: 0,
    center: 0,
    top: 0,
  }
}

/**
 * Places marker `i` on `g`, false where its row is hidden. `g.drawn` is
 * whether the marker outgrows the span it stands on; its centre and top are
 * written either way, for a count that draws on the span instead.
 */
function placeInsertion(c: InsertionChannels, g: InsertionFrame, i: number) {
  const slot = rowSlot(c.row, i, g.params.rowTable)
  if (slot === undefined) {
    return false
  }
  const { rowHeight, rowOffsetPx, bandHeightPx, spanFloorPx } = g.params
  const x1 = projectBp(g, c.x[i]!)
  const x2 = projectBp(g, c.x2[i]!)
  g.barWidth = insertionBarWidthPx(c.length[i]!, g.pxPerBp, bandHeightPx)
  g.drawn = insertionMarkerDraws(g.barWidth, x2 - x1, spanFloorPx)
  g.center = (x1 + x2) / 2
  g.top = rowOffsetPx + rowHeight * slot
  return true
}

function inkWidth(c: InsertionChannels, g: InsertionFrame, i: number) {
  return Math.max(g.barWidth, insertionSerifsWidthPx(c.length[i]!, g.pxPerBp))
}

/**
 * The box marker `i` draws in `block`, undefined where it draws nothing: the
 * bar, widened to its serif caps. What a display's hover box and hit target
 * read, so neither can measure a marker the painter did not draw.
 */
export function insertionInk(
  c: InsertionChannels,
  block: BpRegionBounds,
  params: InsertionParams,
  i: number,
): InkRect | undefined {
  const g = insertionFrame(block, params)
  if (!placeInsertion(c, g, i) || !g.drawn) {
    return undefined
  }
  const width = inkWidth(c, g, i)
  return {
    left: g.center - width / 2,
    top: g.top,
    width,
    height: params.bandHeightPx,
  }
}

/**
 * Insertion markers as one mark: a 1px tick, a short bar, or a box sized for
 * its count, with serif caps on small insertions zoomed in. The geometry is
 * render-core's `insertionGlyph.slang`, which the pileup's insertion pass
 * shares; the counts are text, so `paintInsertionLabels` draws them over
 * either backend.
 */
export const insertionMark: MarkShape<InsertionChannels, InsertionParams> = {
  id: 'insertion',
  pass: {
    ...slangPass({ id: 'insertion', mod: shader }),
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      viewportWidth: clip.scissorW,
      zero: 0,
      pxPerBp: pxPerBpOf(block),
      rowHeight: params.rowHeight,
      rowOffsetPx: params.rowOffsetPx,
      bandHeightPx: params.bandHeightPx,
      spanFloorPx: params.spanFloorPx,
      outline: params.outline ? 1 : 0,
      rowTableKeys: rowTableKeys(params),
    })
  },

  textures: rowTableTextures,

  paintBlock(ctx, c, block, frame, params) {
    const g = insertionFrame(block, params)
    const h = params.bandHeightPx
    const outlines = params.outline && h >= MIN_OUTLINED_PX
    if (outlines) {
      ctx.strokeStyle = OUTLINE_CSS
      ctx.lineWidth = 1
    }
    let fill: number | undefined
    for (let i = 0; i < c.count; i++) {
      if (
        placeInsertion(c, g, i) &&
        g.drawn &&
        g.top + h >= 0 &&
        g.top <= frame.canvasHeight
      ) {
        const w = g.barWidth
        if (c.color[i] !== fill) {
          fill = c.color[i]!
          ctx.fillStyle = abgrToCssRgba(fill)
        }
        ctx.fillRect(g.center - w / 2, g.top, w, h)
        drawInsertionSerifs(ctx, g.center, g.top, h, c.length[i]!, g.pxPerBp)
        if (outlines && w >= MIN_OUTLINED_PX) {
          strokeRectInside(ctx, g.center - w / 2, g.top, w, h)
        }
      }
    }
  },

  ink(c, block, _frame, params, i) {
    return insertionInk(c, block, params, i)
  },
}

interface LabelContext2D {
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  fillStyle: string | CanvasGradient | CanvasPattern
  fillText(text: string, x: number, y: number): void
}

/**
 * The counts on one block's markers. A large insertion's count sits centred in
 * its box, in the text colour that clears the box (`getContrastText`), or on
 * `under` where the span outgrew the marker; a small one zoomed in to base
 * level gets `(N)` beside its bar in the marker's colour. Nothing draws in a
 * band shorter than `MIN_HEIGHT_FOR_TEXT`, and the font is set only once a
 * label draws: touching canvas text flushes the document's pending style.
 */
export function paintBlockInsertionLabels(
  ctx: LabelContext2D,
  c: InsertionChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: InsertionParams,
) {
  const h = params.bandHeightPx
  if (h < MIN_HEIGHT_FOR_TEXT) {
    return
  }
  const g = insertionFrame(block, params)
  const smallLabels = g.pxPerBp >= MIN_PX_PER_BP_FOR_TEXT
  const contrast = new Map<number, string>()
  const textOn = (abgr: number) => {
    let text = contrast.get(abgr)
    if (text === undefined) {
      text = getContrastText(abgrToCssRgba(abgr))
      contrast.set(abgr, text)
    }
    return text
  }
  let fontSet = false
  for (let i = 0; i < c.count; i++) {
    if (
      !placeInsertion(c, g, i) ||
      g.top + h < 0 ||
      g.top > frame.canvasHeight
    ) {
      continue
    }
    const length = c.length[i]!
    const type = getInsertionType(length, g.pxPerBp)
    const background =
      type !== 'large'
        ? undefined
        : g.drawn
          ? c.color[i]!
          : c.under
            ? rowColor(c.under[i]!, c.row, i, params.rowTable)
            : undefined
    const small = type === 'small' && smallLabels && g.drawn
    if (background === undefined && !small) {
      continue
    }
    if (!fontSet) {
      ctx.font = labelFont(h).css
      ctx.textBaseline = 'middle'
      fontSet = true
    }
    const y = Math.round(g.top + h / 2)
    if (background !== undefined) {
      ctx.fillStyle = textOn(background)
      ctx.textAlign = 'center'
      ctx.fillText(String(length), g.center, y)
    } else {
      ctx.fillStyle = abgrToCssRgba(c.color[i]!)
      ctx.textAlign = 'left'
      ctx.fillText(`(${length})`, g.center + 3, y)
    }
  }
}

/**
 * The counts over every block, each clipped to its column: what a display's
 * label overlay and its SVG export draw over the insertion mark.
 */
export function paintInsertionLabels(
  ctx: LabelContext2D & Parameters<typeof forEachClippedBlock>[0],
  blocks: readonly RenderBlock[],
  channelsOf: (block: RenderBlock) => InsertionChannels | undefined,
  frame: MarkFrame,
  params: InsertionParams,
) {
  forEachClippedBlock(
    ctx,
    blocks,
    frame.canvasWidth,
    frame.canvasHeight,
    block => {
      const c = channelsOf(block)
      return c?.count ? c : undefined
    },
    (c, block) => {
      paintBlockInsertionLabels(ctx, c, block, frame, params)
    },
  )
}
