import { findManhattanHit } from './findManhattanHit.ts'

import type { ManhattanRenderState } from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

// One block covering bp 0..1000 across 100 screen px (10 bp/px).
const block: RenderBlock = {
  displayedRegionIndex: 0,
  bpRangeX: [0, 1000],
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

const state: ManhattanRenderState = {
  domainY: [0, 10],
  canvasWidth: 100,
  canvasHeight: 100,
}

const refNames = new Map([[0, 'chr1']])

function mkData(
  positions: number[],
  scores: number[],
): Map<number, ManhattanRpcResult> {
  return new Map([
    [
      0,
      {
        positions: new Uint32Array(positions),
        scores: new Float32Array(scores),
        colors: new Uint32Array(positions.length),
        numFeatures: positions.length,
        scoreMin: 0,
        scoreMax: 0,
        scoreSum: 0,
        scoreSumSq: 0,
      },
    ],
  ])
}

test('returns undefined when nothing within hit radius', () => {
  // bp=500 → screen (50, 50). Mouse far away at (0,0).
  expect(
    findManhattanHit(0, 0, [block], mkData([500], [5]), state, refNames),
  ).toBeUndefined()
})

test('finds nearest point within hit radius', () => {
  expect(
    findManhattanHit(51, 49, [block], mkData([500], [5]), state, refNames),
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
    mkData([500, 510], [5, 5]),
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
  // Reversed: bp=900 → screen x = (1000 - 900) / 10 = 10
  const hit = findManhattanHit(
    10,
    50,
    [{ ...block, reversed: true }],
    mkData([900], [5]),
    state,
    refNames,
  )
  expect(hit?.start).toBe(900)
})
