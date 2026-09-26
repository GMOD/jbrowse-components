import { SimpleFeature } from '@jbrowse/core/util'

import { Slice } from '../CircularView/slices.ts'
import { ChordPicker, paintShapes, shapePath } from './chordLayer.ts'
import { canvasPathSink, svgPathSink } from './pathSink.ts'
import { traceRibbon } from './ribbonGeometry.ts'
import { chordShape, ribbonShape } from './shapes.ts'

import type { ChordFrame } from './chordLayer.ts'
import type { ChordLayerDisplay } from './shapes.ts'

const RADIUS = 200
const BEZIER = 20

function block(refName: string, offsetRadians: number, widthBp = 1000) {
  return new Slice(
    { bpPerRadian: 1000 },
    {
      elided: false,
      widthBp,
      start: 0,
      end: widthBp,
      refName,
      assemblyName: 'asm',
    },
    offsetRadians,
  )
}

// two arcs a radian wide, opposite each other, and a long one for arcs past π
const slices: Record<string, Slice> = {
  a: block('a', 0),
  b: block('b', Math.PI),
  long: block('long', 0.5, 4000),
}
const sliceFor = (_asm: string | undefined, refName: string) => slices[refName]

function ribbon(
  id: string,
  start: number,
  end: number,
  fill = '#4682b4',
  strand = 1,
  refNames: [string, string] = ['a', 'b'],
) {
  return ribbonShape({
    feature: new SimpleFeature({
      uniqueId: id,
      assemblyName: 'asm',
      refName: refNames[0],
      start,
      end,
      strand,
      mate: { assemblyName: 'asm', refName: refNames[1], start, end },
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
    displayPhase: 'ready',
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

// the svg arc's sweep and large-arc flags and the canvas arc's direction, read
// off the same trace, so a flipped direction on either side fails here
function arcFlags(svg: string) {
  return [...svg.matchAll(/A [\d.]+ [\d.]+ 0 (\d) (\d)/g)].map(m => ({
    largeArc: m[1] === '1',
    sweep: m[2] === '1',
  }))
}

function canvasArcs(calls: string[]) {
  return calls
    .filter(c => c.startsWith('arc('))
    .map(c => {
      const [, , , from, to, anticlockwise] = c
        .slice(4, -1)
        .split(',')
        .map(v => (v === 'true' || v === 'false' ? v === 'true' : Number(v)))
      return {
        from: from as number,
        to: to as number,
        anticlockwise: anticlockwise as boolean,
      }
    })
}

describe('one trace, two sinks', () => {
  test.each([
    ['forward, short arcs', ribbon('r', 100, 400)],
    ['reverse strand', ribbon('r', 100, 400, '#000', -1)],
    ['an arc longer than π', ribbon('r', 0, 4000, '#000', 1, ['long', 'b'])],
  ])('%s: the svg flags and the canvas direction agree', (_name, shape) => {
    const svg = svgPathSink()
    traceRibbon(svg, shape.angles, RADIUS, BEZIER)
    const { ctx, calls } = recordingContext()
    traceRibbon(canvasPathSink(ctx), shape.angles, RADIUS, BEZIER)
    expect(svg.toString()).toBe(shapePath(shape, RADIUS, BEZIER))
    const flags = arcFlags(svg.toString())
    const arcs = canvasArcs(calls)
    expect(flags).toHaveLength(2)
    expect(arcs).toHaveLength(2)
    for (const [i, arc] of arcs.entries()) {
      // a sweep of 1 is an increasing angle, which the canvas draws clockwise
      expect(arc.anticlockwise).toBe(arc.to < arc.from)
      expect(flags[i]!.sweep).toBe(arc.to > arc.from)
      expect(flags[i]!.largeArc).toBe(Math.abs(arc.to - arc.from) > Math.PI)
    }
    expect(calls.map(c => c.split('(')[0])).toEqual([
      'moveTo',
      'arc',
      'quadraticCurveTo',
      'arc',
      'quadraticCurveTo',
      'closePath',
    ])
  })
})

test('the painter fills a ribbon at the display alpha and dims one outside the highlighted set', () => {
  const { ctx, calls } = recordingContext()
  paintShapes(
    ctx,
    display(
      [ribbon('a', 0, 500, '#111111'), ribbon('b', 500, 1000, '#222222')],
      { highlightedFeatureIdSet: new Set(['b']) },
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

// a display on its loading or error ring shows nothing under the ring
test('a display that is not ready paints nothing', () => {
  const { ctx, calls } = recordingContext()
  paintShapes(ctx, display([ribbon('a', 0, 500)], { displayPhase: 'error' }))
  expect(calls.filter(c => c.startsWith('fill('))).toHaveLength(0)
})

// jsdom draws through node-canvas, so the pick canvas is a real raster here
describe('the picker', () => {
  const frame: ChordFrame = {
    width: 500,
    height: 500,
    centerX: 250,
    centerY: 250,
    rotation: 0,
  }
  const wide = ribbon('wide', 0, 1000)
  const narrow = ribbon('narrow', 450, 550)
  const picker = new ChordPicker()
  picker.update([display([wide, narrow])], frame)

  const at = (angle: number, r: number, rotation = 0) =>
    picker.hit(r * Math.cos(angle), r * Math.sin(angle), rotation)

  test('answers the shape under a point', () => {
    expect(at(0.1, RADIUS - 3)?.feature.id()).toBe('wide')
    expect(at(0.5, RADIUS - 3)?.feature.id()).toBe('narrow')
  })

  test('answers the later-painted shape at the edge where two overlap', () => {
    // the narrow ribbon's anchor arc runs 0.45..0.55 rad over the wide one;
    // just inside its edge the 3x3 read holds both ids
    for (const angle of [0.452, 0.455, 0.545, 0.548]) {
      expect(at(angle, RADIUS - 2)?.feature.id()).toBe('narrow')
    }
  })

  test('answers nothing off every shape', () => {
    expect(picker.hit(RADIUS + 5, 0, 0)).toBeUndefined()
    expect(picker.hit(0, 0, 0)?.feature.id()).toBeUndefined()
  })

  // the figure turned since the paint: the point is turned back by the same
  // amount before the read
  test('turns a point back by the rotation the paint has not caught up with', () => {
    const turned = Math.PI / 2
    expect(at(0.5 + turned, RADIUS - 3, turned)?.feature.id()).toBe('narrow')
    expect(at(0.5, RADIUS - 3, turned)?.feature.id()).toBeUndefined()
  })

  test('a display that is not ready has no shapes to hit', () => {
    const silent = new ChordPicker()
    silent.update([display([wide], { displayPhase: 'loading' })], frame)
    expect(silent.hit(RADIUS - 3, 0, 0)).toBeUndefined()
  })

  test('a box that holds only part of a zoomed figure still answers at full scale', () => {
    const zoomed = new ChordPicker()
    // the centre is far outside the box; the wide ribbon's anchor arc at
    // angle ~0 is what lands inside it
    zoomed.update([display([wide])], {
      width: 300,
      height: 300,
      centerX: -100,
      centerY: 150,
      rotation: 0,
    })
    expect(zoomed.hit(RADIUS - 3, 0, 0)?.feature.id()).toBe('wide')
  })
})
