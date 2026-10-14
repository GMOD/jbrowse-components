import { ringCallouts } from './ringCallouts.ts'

import type { Ring, RingDisplay } from './ringHost.ts'
import type { NamedFeature } from '@jbrowse/display-kit/floatingLabelHost'

const stripRadiusPx = 300

function ringOf(namedFeatures: NamedFeature[]): Ring {
  const display: RingDisplay & { namedFeatures: NamedFeature[] } = {
    id: 'genes',
    type: 'LinearBasicDisplay',
    height: 50,
    paintCount: 1,
    painted: true,
    renderNow() {},
    setHostHeight() {},
    configuration: { displayId: 'genes' },
    RenderingComponent: () => null,
    namedFeatures,
  }
  return { display, innerPx: 200, outerPx: 250 }
}

// a feature centred on `turn` of the unrotated strip
function feature(featureId: string, turn: number, width = 10): NamedFeature {
  return {
    featureId,
    text: featureId,
    left: turn * stripRadiusPx - width / 2,
    top: 0,
    width,
    height: 10,
  }
}

const layout = (features: NamedFeature[], offsetRadians = 0) =>
  ringCallouts({
    rings: [ringOf(features)],
    radiusPx: 260,
    stripRadiusPx,
    offsetRadians,
  })

test('each named feature gets a label on its own side of the screen', () => {
  const callouts = layout([feature('east', 0.1), feature('west', Math.PI)])
  expect(callouts.map(c => [c.text, c.side])).toEqual([
    ['east', 'right'],
    ['west', 'left'],
  ])
})

test('the side follows the rotated figure, not the strip', () => {
  const [callout] = layout([feature('east', 0.1)], Math.PI)
  expect(callout!.side).toBe('left')
})

test('the leader starts at the feature and the text sits outside the ruler', () => {
  const [callout] = layout([feature('east', 0)])
  const [start, , end] = callout!.leader
  expect(Math.hypot(...start!)).toBeCloseTo(250)
  expect(Math.hypot(...end!)).toBeGreaterThan(260)
})

test('labels crowded at one height are spread a line apart', () => {
  const callouts = layout([
    feature('a', 0.2),
    feature('b', 0.2001),
    feature('c', 0.2002),
  ])
  const ys = callouts.map(c => c.textXY[1]).sort((a, b) => a - b)
  expect(ys[1]! - ys[0]!).toBeGreaterThanOrEqual(13)
  expect(ys[2]! - ys[1]!).toBeGreaterThanOrEqual(13)
})

test('past what a side holds, the widest features keep their labels', () => {
  const many = Array.from({ length: 200 }, (_, i) =>
    feature(`f${i}`, 0.5, i === 7 ? 100 : 1),
  )
  const callouts = layout(many)
  expect(callouts.length).toBeLessThan(200)
  expect(callouts.some(c => c.text === 'f7')).toBe(true)
})

test('a feature cut at the origin is named once, by its piece before it', () => {
  const callouts = layout([
    feature('dloop', 6.2),
    feature('dloop-origin', 0.05),
  ])
  expect(callouts.map(c => c.text)).toEqual(['dloop'])
})
