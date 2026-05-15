import { findManhattanHit } from './findManhattanHit.ts'

import type { ManhattanRenderState } from './manhattanBackendTypes.ts'
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
  scaleType: 0,
  canvasWidth: 100,
  canvasHeight: 100,
  pointRadius: 2,
}

const refNames = new Map([[0, 'chr1']])

test('returns undefined when nothing within hit radius', () => {
  const positions = new Uint32Array([500])
  const scores = new Float32Array([5])
  const data = new Map([[0, { positions, scores, numFeatures: 1 }]])
  // Point at (50, 50). Mouse far away.
  expect(findManhattanHit(0, 0, [block], data, state, refNames)).toBeUndefined()
})

test('finds nearest point within hit radius', () => {
  // Point at bp=500 score=5 → screen (50, 50)
  const positions = new Uint32Array([500])
  const scores = new Float32Array([5])
  const data = new Map([[0, { positions, scores, numFeatures: 1 }]])
  expect(findManhattanHit(51, 49, [block], data, state, refNames)).toEqual({
    refName: 'chr1',
    start: 500,
    end: 500,
    score: 5,
  })
})

test('picks closest of two candidates', () => {
  // bp=500 → x=50, score=5 → y=50
  // bp=510 → x=51, score=5 → y=50
  const positions = new Uint32Array([500, 510])
  const scores = new Float32Array([5, 5])
  const data = new Map([[0, { positions, scores, numFeatures: 2 }]])
  const hit = findManhattanHit(52, 50, [block], data, state, refNames)
  expect(hit?.start).toBe(510)
})

test('skips blocks with no data', () => {
  const empty = new Map()
  expect(
    findManhattanHit(50, 50, [block], empty, state, refNames),
  ).toBeUndefined()
})

test('respects reversed block direction', () => {
  // Reversed: bp=500 maps to screen x = (1000 - 500) / 10 + 0 = 50
  // bp=900 maps to (1000 - 900) / 10 + 0 = 10
  const positions = new Uint32Array([900])
  const scores = new Float32Array([5])
  const data = new Map([[0, { positions, scores, numFeatures: 1 }]])
  const reversedBlock = { ...block, reversed: true }
  const hit = findManhattanHit(
    10,
    50,
    [reversedBlock],
    data,
    state,
    refNames,
  )
  expect(hit?.start).toBe(900)
})
