import { traceChord } from './chordGeometry.ts'
import { canvasPathSink, svgPathSink } from './pathSink.ts'
import { traceRibbon } from './ribbonGeometry.ts'
import { DIMMED_OPACITY } from './types.ts'

import type {
  ChordHit,
  ChordLayerDisplay,
  ChordPaintSource,
  Shape,
} from './shapes.ts'

/** The width a chord's stroke answers a pointer within, wider than it draws. */
const CHORD_HIT_WIDTH_PX = 6

/** The pick canvas never exceeds this on a side; a bigger figure is scaled. */
const PICK_MAX_PX = 2048

function trace(
  sink: ReturnType<typeof svgPathSink> | ReturnType<typeof canvasPathSink>,
  shape: Shape,
  radius: number,
  bezierRadius: number,
) {
  if (shape.kind === 'ribbon') {
    traceRibbon(sink, shape.angles, radius, bezierRadius)
  } else {
    traceChord(sink, shape.ends, radius, bezierRadius)
  }
}

/** A shape as an SVG path, for the export and the highlight layer. */
export function shapePath(shape: Shape, radius: number, bezierRadius: number) {
  const sink = svgPathSink()
  trace(sink, shape, radius, bezierRadius)
  return sink.toString()
}

function shapeOpacity(source: ChordPaintSource, shape: Shape) {
  const dimmed =
    source.highlightedFeatureIdSet?.has(shape.feature.id()) === false
  return source.shapeAlpha * (dimmed ? DIMMED_OPACITY : 1)
}

/**
 * Every resting shape of one display, into a context already translated to the
 * circle's centre and rotated with the figure.
 */
export function paintShapes(
  ctx: CanvasRenderingContext2D,
  source: ChordPaintSource,
) {
  const { radiusPx, bezierRadius } = source
  const sink = canvasPathSink(ctx)
  ctx.lineWidth = 1
  for (const shape of source.shapes) {
    ctx.globalAlpha = shapeOpacity(source, shape)
    ctx.beginPath()
    trace(sink, shape, radiusPx, bezierRadius)
    if (shape.kind === 'ribbon') {
      ctx.fillStyle = shape.fill
      ctx.fill()
    } else {
      ctx.strokeStyle = shape.stroke
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

function idColor(index: number) {
  const id = index + 1
  return `rgb(${(id >> 16) & 255},${(id >> 8) & 255},${id & 255})`
}

function decodeId(data: Uint8ClampedArray, offset: number) {
  return (
    ((data[offset]! << 16) | (data[offset + 1]! << 8) | data[offset + 2]!) - 1
  )
}

interface PickEntry {
  display: ChordLayerDisplay
  shape: Shape
}

/**
 * Which shape is under a point, answered from a canvas every shape is painted
 * onto in its own id colour, so a hover costs one pixel read however many
 * ribbons the circle holds. An antialiased edge blends two ids into a third,
 * so the ids around the point are candidates that the shape's own outline
 * confirms.
 */
export class ChordPicker {
  private canvas: HTMLCanvasElement | undefined
  private scale = 1
  private entries: PickEntry[] = []

  constructor(private createCanvas = () => document.createElement('canvas')) {}

  /** Repaint the pick canvas for a figure `figureSize` px across. */
  update(displays: readonly ChordLayerDisplay[], figureSize: number) {
    this.canvas ??= this.createCanvas()
    const { canvas } = this
    const scale = Math.min(1, PICK_MAX_PX / Math.max(figureSize, 1))
    const size = Math.max(1, Math.ceil(figureSize * scale))
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size
      canvas.height = size
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return
    }
    this.scale = scale
    this.entries = []
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, size, size)
    ctx.setTransform(scale, 0, 0, scale, size / 2, size / 2)
    ctx.lineWidth = CHORD_HIT_WIDTH_PX / scale
    const sink = canvasPathSink(ctx)
    for (const display of displays) {
      const { radiusPx, bezierRadius } = display
      for (const shape of display.shapes) {
        const color = idColor(this.entries.length)
        this.entries.push({ display, shape })
        ctx.beginPath()
        trace(sink, shape, radiusPx, bezierRadius)
        if (shape.kind === 'ribbon') {
          ctx.fillStyle = color
          ctx.fill()
        } else {
          ctx.strokeStyle = color
          ctx.stroke()
        }
      }
    }
  }

  /**
   * The shape under a point `dx`,`dy` CSS px from the circle's centre in the
   * figure's own frame, before the view's rotation.
   */
  hit(dx: number, dy: number): ChordHit | undefined {
    const { canvas, scale, entries } = this
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx || !entries.length) {
      return undefined
    }
    const px = dx * scale + canvas.width / 2
    const py = dy * scale + canvas.height / 2
    const x0 = Math.floor(px) - 1
    const y0 = Math.floor(py) - 1
    if (
      x0 + 3 <= 0 ||
      y0 + 3 <= 0 ||
      x0 >= canvas.width ||
      y0 >= canvas.height
    ) {
      return undefined
    }
    const { data } = ctx.getImageData(x0, y0, 3, 3)
    const candidates = new Set<number>()
    for (let i = 0; i < 9; i++) {
      if (data[i * 4 + 3]) {
        candidates.add(decodeId(data, i * 4))
      }
    }
    const sink = canvasPathSink(ctx)
    const size = canvas.width
    for (const index of candidates) {
      const entry = entries[index]
      if (!entry) {
        continue
      }
      const { display, shape } = entry
      ctx.setTransform(scale, 0, 0, scale, size / 2, size / 2)
      ctx.lineWidth = CHORD_HIT_WIDTH_PX / scale
      ctx.beginPath()
      trace(sink, shape, display.radiusPx, display.bezierRadius)
      // the point is queried in device space: browsers take it that way, and
      // node-canvas takes user space, so with the identity in place both agree
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const inside =
        shape.kind === 'ribbon'
          ? ctx.isPointInPath(px, py)
          : ctx.isPointInStroke(px, py)
      if (inside) {
        return { display, feature: shape.feature }
      }
    }
    return undefined
  }
}
