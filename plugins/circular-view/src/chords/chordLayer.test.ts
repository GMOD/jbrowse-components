import { SimpleFeature } from '@jbrowse/core/util'

import { Slice } from '../CircularView/slices.ts'
import { ChordPicker, paintShapes, shapePath } from './chordLayer.ts'
import { canvasPathSink, svgPathSink } from './pathSink.ts'
import { traceRibbon } from './ribbonGeometry.ts'
import { chordShape, ribbonShape } from './shapes.ts'

import type { ChordLayerDisplay } from './shapes.ts'

const RADIUS = 200
const BEZIER = 20

function block(refName: string, offsetRadians: number) {
  return new Slice(
    { bpPerRadian: 1000 },
    {
      elided: false,
      widthBp: 1000,
      start: 0,
      end: 1000,
      refName,
      assemblyName: 'asm',
    },
    offsetRadians,
  )
}

// two arcs a quarter turn wide, opposite each other
const slices: Record<string, Slice> = {
  a: block('a', 0),
  b: block('b', Math.PI),
}
const sliceFor = (_asm: string | undefined, refName: string) => slices[refName]

function ribbon(id: string, start: number, end: number, fill = '#4682b4') {
  return ribbonShape({
    feature: new SimpleFeature({
      uniqueId: id,
      assemblyName: 'asm',
      refName: 'a',
      start,
      end,
      strand: 1,
      mate: { assemblyName: 'asm', refName: 'b', start, end },
    }),
    sliceFor,
    radius: RADIUS,
    fill,
  })!
}

function display(
  shapes: ChordLayerDisplay['shapes'],
  extra: Partial<ChordLayerDisplay> = {},
): ChordLayerDisplay {
  return {
    id: 'd',
    shapes,
    radiusPx: RADIUS,
    bezierRadius: BEZIER,
    shapeAlpha: 0.25,
    clickFeature: () => {},
    shapeLabel: f => f.id(),
    ...extra,
  }
}

function recordingContext() {
  const calls: string[] = []
  const state: Record<string, unknown> = {}
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, key: string) =>
      key in state
        ? state[key]
        : (...args: unknown[]) => {
            calls.push(
              `${key}(${args.map(a => (typeof a === 'number' ? a.toFixed(2) : String(a))).join(',')})`,
            )
            if (key === 'fill' || key === 'stroke') {
              calls.push(
                `  alpha=${state.globalAlpha} paint=${state.fillStyle ?? state.strokeStyle}`,
              )
            }
          },
    set: (_t, key: string, value) => {
      state[key] = value
      return true
    },
  })
  return { ctx, calls }
}

test('the svg and canvas sinks trace one outline', () => {
  const shape = ribbon('r', 100, 400)
  const svg = svgPathSink()
  traceRibbon(svg, shape.angles, RADIUS, BEZIER)
  const { ctx, calls } = recordingContext()
  traceRibbon(canvasPathSink(ctx), shape.angles, RADIUS, BEZIER)
  expect(svg.toString()).toBe(shapePath(shape, RADIUS, BEZIER))
  expect(calls.map(c => c.split('(')[0])).toEqual([
    'moveTo',
    'arc',
    'quadraticCurveTo',
    'arc',
    'quadraticCurveTo',
    'closePath',
  ])
  // the same arc, the same way round: the svg sweeps from a1 to a2 and the
  // canvas arc runs the same two angles
  const svgArcs = svg.toString().match(/A [^A-Z]*/g)!
  const canvasArcs = calls.filter(c => c.startsWith('arc('))
  expect(svgArcs).toHaveLength(2)
  expect(canvasArcs).toHaveLength(2)
})

test('the painter fills a ribbon at the display alpha and dims one outside the highlighted set', () => {
  const { ctx, calls } = recordingContext()
  paintShapes(
    ctx,
    display(
      [ribbon('a', 0, 500, '#111111'), ribbon('b', 500, 1000, '#222222')],
      {
        highlightedFeatureIdSet: new Set(['b']),
      },
    ),
  )
  const paints = calls.filter(c => c.startsWith('  alpha='))
  expect(paints).toEqual([
    `  alpha=${0.25 * 0.15} paint=#111111`,
    '  alpha=0.25 paint=#222222',
  ])
})

test('the painter strokes a chord in its own colour', () => {
  const chord = chordShape({
    feature: new SimpleFeature({
      uniqueId: 'c',
      refName: 'a',
      start: 100,
      end: 101,
      ALT: ['C]b:500]'],
    }),
    sliceFor: refName => slices[refName],
    radius: RADIUS,
    stroke: 'rgba(255,133,0,0.32)',
  })!
  const { ctx, calls } = recordingContext()
  paintShapes(ctx, display([chord], { shapeAlpha: 1 }))
  expect(calls.filter(c => c.startsWith('stroke('))).toHaveLength(1)
  expect(calls.filter(c => c.startsWith('fill('))).toHaveLength(0)
  expect(calls.find(c => c.startsWith('  alpha='))).toBe(
    '  alpha=1 paint=rgba(255,133,0,0.32)',
  )
})

// jsdom draws through node-canvas, so the pick canvas is a real raster here
describe('the picker', () => {
  const wide = ribbon('wide', 0, 1000)
  const narrow = ribbon('narrow', 450, 550)
  const picker = new ChordPicker()
  picker.update([display([wide, narrow])], 2 * RADIUS + 20)

  // a point on the wide ribbon's anchor arc, just inside the rim, in the
  // half the narrow one does not cover
  const onWide = { angle: 0.1, r: RADIUS - 3 }
  const onNarrow = { angle: 0.5, r: RADIUS - 3 }
  const at = ({ angle, r }: { angle: number; r: number }) =>
    picker.hit(r * Math.cos(angle), r * Math.sin(angle))

  test('answers the shape under a point, the later-painted one on top', () => {
    expect(at(onWide)?.feature.id()).toBe('wide')
    expect(at(onNarrow)?.feature.id()).toBe('narrow')
  })

  test('answers nothing off every shape', () => {
    expect(picker.hit(RADIUS + 5, 0)).toBeUndefined()
    expect(picker.hit(0, 0)?.feature.id()).toBeUndefined()
  })

  test('is scaled down for a figure wider than its canvas and still answers', () => {
    const big = new ChordPicker()
    big.update([display([wide])], 6000)
    expect(big.hit(RADIUS - 3, 0)?.feature.id()).toBe('wide')
  })
})
