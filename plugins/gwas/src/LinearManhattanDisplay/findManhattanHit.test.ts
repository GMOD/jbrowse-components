import { findManhattanHit } from './findManhattanHit.ts'

import type {
  WiggleGPURenderState,
  WiggleRenderBlock,
} from '@jbrowse/plugin-wiggle'

// One block covering bp 0..1000 across 100 screen px (10 bp/px).
const block: WiggleRenderBlock = {
  displayedRegionIndex: 0,
  bpRangeX: [0, 1000],
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

const state: WiggleGPURenderState = {
  domainY: [0, 10],
  scaleType: 0,
  renderingType: 0,
  canvasWidth: 100,
  canvasHeight: 100,
}

const refNames = new Map([[0, 'chr1']])

function mkData(featurePositions: number[], featureScores: number[]) {
  return new Map([
    [
      0,
      {
        sources: [
          {
            featurePositions: new Uint32Array(featurePositions),
            featureScores: new Float32Array(featureScores),
            numFeatures: featureScores.length,
          },
        ],
      },
    ],
  ])
}

test('returns undefined when nothing within hit radius', () => {
  // bp=500 → screen (50, 50). Mouse far away at (0,0).
  expect(
    findManhattanHit(0, 0, [block], mkData([500, 501], [5]), state, refNames),
  ).toBeUndefined()
})

test('finds nearest point within hit radius', () => {
  expect(
    findManhattanHit(51, 49, [block], mkData([500, 501], [5]), state, refNames),
  ).toEqual({
    refName: 'chr1',
    start: 500,
    end: 501,
    score: 5,
    screenX: 50,
    screenY: 50,
  })
})

test('picks closest of two candidates', () => {
  // bp=500 → x=50, bp=510 → x=51 (both at score=5 → y=50)
  const hit = findManhattanHit(
    52,
    50,
    [block],
    mkData([500, 501, 510, 511], [5, 5]),
    state,
    refNames,
  )
  expect(hit?.start).toBe(510)
})

test('skips blocks with no data', () => {
  expect(
    findManhattanHit(50, 50, [block], new Map(), state, refNames),
  ).toBeUndefined()
})

test('respects reversed block direction', () => {
  // Reversed: bp=900 → screen x = (1000 - 900) / 10 + 0 = 10
  const hit = findManhattanHit(
    10,
    50,
    [{ ...block, reversed: true }],
    mkData([900, 901], [5]),
    state,
    refNames,
  )
  expect(hit?.start).toBe(900)
})
