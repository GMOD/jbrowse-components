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

/**
 * Where the circle sits in the view's box at the moment of a paint: the
 * canvas is the box, the centre is where the figure's origin and pan put it,
 * and the rotation is baked into the paint.
 */
export interface ChordFrame {
  width: number
  height: number
  centerX: number
  centerY: number
  rotation: number
}

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

/** Whether a display's shapes are drawn: its frame shows them only when ready. */
export function paintsShapes(source: ChordPaintSource) {
  return source.displayPhase === 'ready'
}

/**
 * Every resting shape of one display, into a context already translated to the
 * circle's centre and rotated with the figure. A display on its loading or
 * error ring paints nothing, as its frame draws nothing under the ring.
 */
export function paintShapes(
  ctx: CanvasRenderingContext2D,
  source: ChordPaintSource,
) {
  if (!paintsShapes(source)) {
    return
  }
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
 * ribbons the circle holds. The canvas is the view's box in the frame the
 * shapes were last painted in, so it never scales down on a zoomed figure. An
 * antialiased edge blends two ids into a third, so the ids around the point
 * are candidates that the shape's own outline confirms, later-painted first.
 */
export class ChordPicker {
  private canvas: HTMLCanvasElement | undefined
  private frame: ChordFrame | undefined
  private entries: PickEntry[] = []

  constructor(private createCanvas = () => document.createElement('canvas')) {}

  /** Repaint the pick canvas for the displays as `frame` places them. */
  update(displays: readonly ChordLayerDisplay[], frame: ChordFrame) {
    this.canvas ??= this.createCanvas()
    const { canvas } = this
    const width = Math.max(1, Math.ceil(frame.width))
    const height = Math.max(1, Math.ceil(frame.height))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return
    }
    this.frame = frame
    this.entries = []
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    this.place(ctx)
    ctx.lineWidth = CHORD_HIT_WIDTH_PX
    const sink = canvasPathSink(ctx)
    for (const display of displays) {
      if (!paintsShapes(display)) {
        continue
      }
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

  private place(ctx: CanvasRenderingContext2D) {
    const { centerX, centerY, rotation } = this.frame!
    ctx.setTransform(1, 0, 0, 1, centerX, centerY)
    ctx.rotate(rotation)
  }

  /**
   * The shape under a point `dx`,`dy` CSS px from the circle's centre in the
   * screen frame, with the figure at `rotation`. Between a rotation and the
   * repaint that bakes it in, the painted frame lags by the difference, and
   * the point is turned back by that much.
   */
  hit(dx: number, dy: number, rotation: number): ChordHit | undefined {
    const { canvas, frame, entries } = this
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx || !frame || !entries.length) {
      return undefined
    }
    const delta = frame.rotation - rotation
    const cos = Math.cos(delta)
    const sin = Math.sin(delta)
    const px = frame.centerX + dx * cos - dy * sin
    const py = frame.centerY + dx * sin + dy * cos
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
    // later-painted shapes lie on top, so they answer first
    for (const index of [...candidates].sort((a, b) => b - a)) {
      const entry = entries[index]
      if (!entry) {
        continue
      }
      const { display, shape } = entry
      this.place(ctx)
      ctx.lineWidth = CHORD_HIT_WIDTH_PX
      ctx.beginPath()
      trace(sink, shape, display.radiusPx, display.bezierRadius)
      // the point is queried in device space: browsers take it that way, and
      // node-canvas takes user space, so with the identity in place both agree.
      // node-canvas has no isPointInStroke, so a chord's id pixel stands there
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const inside =
        shape.kind === 'ribbon'
          ? ctx.isPointInPath(px, py)
          : 'isPointInStroke' in ctx
            ? ctx.isPointInStroke(px, py)
            : true
      if (inside) {
        return { display, feature: shape.feature }
      }
    }
    return undefined
  }
}
