import { sweepDrawAgainstHit } from '@jbrowse/render-core/marks/drawAgainstHit'

import { scoreMark } from './scoreMark.ts'

import type { ScoreChannels } from './scoreMark.ts'

// 1000 bp over 200 px, so the 1 bp box is a fifth of a pixel and takes the
// MIN_WIDTH_PX floor; the first two boxes overlap and the tallest is full
// height, which puts its top on the canvas edge.
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 20,
  screenEndPx: 220,
  reversed: false,
}

const frame = { canvasWidth: 240, canvasHeight: 60 }

const channels: ScoreChannels = {
  startBp: Uint32Array.from([100, 300, 500, 900]),
  endBp: Uint32Array.from([400, 450, 501, 1000]),
  score: Float32Array.from([0.5, 0.25, 1, 0.1]),
  count: 4,
}

// The draw-against-hit gate: every point the painter inked answers the box it
// is on, a hit's ink lies on its box, and no answer is nearer than the box. In
// both orientations, at containment and with a grab radius.
describe('score: every drawn box answers its own hit', () => {
  for (const reversed of [false, true]) {
    for (const maxDistSq of [Number.MIN_VALUE, 16]) {
      test(`reversed ${reversed}, bound ${maxDistSq}`, () => {
        expect(
          sweepDrawAgainstHit(
            scoreMark,
            channels,
            { ...block, reversed },
            frame,
            { color: 0xff0000ff },
            { maxDistSq },
          ),
        ).toEqual([])
      })
    }
  }
})
