import { SimpleFeature } from '@jbrowse/core/util'

import { arcExtent } from './arcLayout.ts'
import { drawArcs } from './drawArcs.ts'

import type { LaidOutArc } from './arcLayout.ts'
import type { ArcShape } from './arcShape.ts'
import type { Feature } from '@jbrowse/core/util'

// A ctx that records what it was asked to paint, in order. The precedence rules
// below used to live in JSX ternaries the DOM could be asked about; on canvas
// the only place they are observable is the call sequence.
function recorder() {
  const calls: string[] = []
  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    bezierCurveTo() {},
    stroke() {
      calls.push(`stroke ${ctx.strokeStyle} @${ctx.lineWidth}`)
    },
    strokeText(t: string) {
      calls.push(`halo ${t} ${ctx.strokeStyle} @${round2(ctx.lineWidth)}`)
    },
    fillText(t: string) {
      calls.push(`label ${t} ${ctx.fillStyle}`)
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const round2 = (n: number) => Math.round(n * 100) / 100

function feature(id: string): Feature {
  return new SimpleFeature({ uniqueId: id, refName: 'ctgA', start: 0, end: 1 })
}

function arc(
  id: string,
  shape: ArcShape,
  extra: Partial<LaidOutArc> = {},
): LaidOutArc {
  const strokeWidth = extra.strokeWidth ?? 2
  return {
    feature: feature(id),
    key: id,
    shape,
    color: 'darkblue',
    strokeWidth,
    selected: false,
    ...arcExtent(shape, strokeWidth, extra.ticks),
    ...extra,
  }
}

const dome = (left: number, right: number): ArcShape => ({
  kind: 'bezier',
  left,
  right,
  height: 40,
})

const OPTS = { hoverColor: 'white', viewWidth: 800, font: '12px sans-serif' }

test('the arc under the cursor takes the hover color, and gives it back', () => {
  const a = arc('a', dome(0, 400))
  const cold = recorder()
  drawArcs(cold.ctx, [a], OPTS)
  expect(cold.calls).toEqual(['stroke darkblue @2'])

  const hot = recorder()
  drawArcs(hot.ctx, [a], { ...OPTS, hovered: a.feature })
  expect(hot.calls).toEqual(['stroke white @2'])
})

test('a selected arc is red, and stays red under the cursor', () => {
  const a = arc('a', dome(0, 400), { selected: true })
  const { ctx, calls } = recorder()
  drawArcs(ctx, [a], { ...OPTS, hovered: a.feature })
  expect(calls).toEqual(['stroke red @2'])
})

test('an arc with no ink in the viewport is not painted', () => {
  const off = arc('off', dome(-900, -500))
  const on = arc('on', dome(-100, 300))
  const { ctx, calls } = recorder()
  drawArcs(ctx, [off, on], OPTS)
  expect(calls).toEqual(['stroke darkblue @2'])
})

test("a direction tick strokes at the arc's own width and color", () => {
  const a = arc('a', dome(100, 500), {
    strokeWidth: 3,
    ticks: [{ x1: 100, x2: 120, y: 1.5 }],
  })
  const { ctx, calls } = recorder()
  drawArcs(ctx, [a], OPTS)
  expect(calls).toEqual(['stroke darkblue @3', 'stroke darkblue @3'])
})

// The ordering the DOM used to give for free: as one `<g>` per arc inside one
// `<svg>`, every label was painted after every curve before it. Interleaved on a
// canvas, a later arc's stroke crosses an earlier arc's label.
test('every curve is painted before any label', () => {
  const a = arc('a', dome(0, 400), { label: 'one' })
  const b = arc('b', dome(200, 600), { label: 'two' })
  const { ctx, calls } = recorder()
  drawArcs(ctx, [a, b], OPTS)
  expect(calls).toEqual([
    'stroke darkblue @2',
    'stroke darkblue @2',
    'halo one white @7.2',
    'label one black',
    'halo two white @7.2',
    'label two black',
  ])
})

test('the halo scales with the font, the way 0.6em did', () => {
  const a = arc('a', dome(0, 400), { label: 'x' })
  const { ctx, calls } = recorder()
  drawArcs(ctx, [a], { ...OPTS, font: 'bold 20px Roboto, sans-serif' })
  expect(calls).toContain('halo x white @12')
})

test('a selected arc labels in red too', () => {
  const a = arc('a', dome(0, 400), { label: 'x', selected: true })
  const { ctx, calls } = recorder()
  drawArcs(ctx, [a], OPTS)
  expect(calls).toContain('label x red')
})
