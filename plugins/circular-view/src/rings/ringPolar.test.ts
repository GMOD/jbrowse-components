import { ringHit } from './ringHost.ts'
import {
  MIN_RING_LABEL_PX,
  ringLabels,
  stripPointToPolar,
  stripRectToSectorPath,
} from './ringPolar.ts'

import type { RingDisplay } from './ringHost.ts'

const display = (height: number): RingDisplay => ({
  id: 'genes',
  type: 'LinearBasicDisplay',
  height,
  paintCount: 1,
  painted: true,
  renderNow() {},
  configuration: { displayId: 'genes' },
  RenderingComponent: () => null,
})

const label = (x: number, y: number, width: number, text = 'ND1') => ({
  key: `${x}-${y}`,
  x,
  y,
  width,
  text,
  color: 'black',
  fontSize: 10,
})

test('a strip point lands where ringHit reads it back, on a shrunk band too', () => {
  const ring = { display: display(100), innerPx: 250, outerPx: 300 }
  const { radians, radiusPx } = stripPointToPolar(ring, 900, 30, 400)
  const hit = ringHit(
    [ring],
    radiusPx * Math.cos(radians),
    radiusPx * Math.sin(radians),
    0,
    400,
  )!
  expect(hit.x).toBeCloseTo(900)
  expect(hit.y).toBeCloseTo(30)
})

test('a rect becomes a sector clamped to its band, and one off the band none', () => {
  const ring = { display: display(100), innerPx: 200, outerPx: 300 }
  expect(
    stripRectToSectorPath(
      ring,
      { left: 0, top: 10, width: 50, height: 20 },
      400,
    ),
  ).toMatch(/^M .* A 290 290 .* A 270 270 /)
  expect(
    stripRectToSectorPath(
      ring,
      { left: 0, top: 150, width: 50, height: 20 },
      400,
    ),
  ).toBeUndefined()
})

test('an inner ring drops a label the next on its line now overruns, and pulls one back off the strip end', () => {
  const ring = { display: display(100), innerPx: 100, outerPx: 200 }
  const stripRadiusPx = 400
  const end = 2 * Math.PI * stripRadiusPx
  const kept = ringLabels(
    ring,
    [
      label(0, 20, 30),
      label(40, 20, 30),
      label(200, 20, 30),
      label(end - 5, 60, 30),
    ],
    stripRadiusPx,
  )
  expect(kept.map(k => k.key)).toEqual(['0-20', '200-20', `${end - 5}-60`])
  const last = kept.at(-1)!
  expect(last.radians + last.turn / 2).toBeCloseTo(2 * Math.PI)
  expect(kept[0]!.radiusPx).toBeCloseTo(200 - 25)
})

test('labels on two lines cull each other where their text meets, as a text mark at its value places them', () => {
  const ring = { display: display(100), innerPx: 100, outerPx: 200 }
  const kept = ringLabels(
    ring,
    [label(0, 20, 30), label(20, 25, 30), label(20, 40, 30)],
    400,
  )
  expect(kept.map(k => k.key)).toEqual(['0-20', '20-40'])
})

test('a label pulled back to the strip end yields to one at its start on the same line', () => {
  const ring = { display: display(100), innerPx: 100, outerPx: 200 }
  const end = 2 * Math.PI * 400
  const kept = ringLabels(
    ring,
    [label(end - 5, 20, 30), label(0, 20, 30), label(end - 5, 60, 30)],
    400,
  )
  expect(kept.map(k => k.key)).toEqual(['0-20', `${end - 5}-60`])
})

test('a feature cut at the origin is labelled once, by its piece before the origin', () => {
  const ring = { display: display(100), innerPx: 100, outerPx: 200 }
  const end = 2 * Math.PI * 400
  const piece = (x: number, featureId: string) => ({
    ...label(x, 20, 30, 'D-loop'),
    featureId,
  })
  expect(
    ringLabels(
      ring,
      [piece(end - 200, 'dloop'), piece(0, 'dloop-origin')],
      400,
    ).map(k => k.key),
  ).toEqual([`${end - 200}-20`])
  expect(
    ringLabels(ring, [piece(0, 'dloop-origin')], 400).map(k => k.key),
  ).toEqual(['0-20'])
})

test('a band shrunk past reading keeps no label', () => {
  const ring = { display: display(100), innerPx: 190, outerPx: 200 }
  expect(10 / (100 / 10)).toBeLessThan(MIN_RING_LABEL_PX)
  expect(ringLabels(ring, [label(0, 20, 30)], 400)).toEqual([])
})
