import {
  markerDirection,
  strandMatchesEdge,
} from '../passes/shaders/continuation.js.generated.ts'
import { CONT_TRI_W_PX } from './sharedRendererConstants.ts'

// Retirement gate for the continuation marker's sign arithmetic (adr-051).
// Canvas2D and continuation.slang each expressed every direction as
// `edgeSide × …` so that the left and right edges were one piece of arithmetic
// rather than two — and then there were two of *those*, one per backend, agreed
// by eye.
//
// The domain is small enough to sweep exhaustively: screen strand is -1, 0 or
// +1 (0 for a strand-less feature, and it is flipX(0) = 0 that made the
// reversed-region export snapshot blind to a real bug here), and edgeSide is
// ±1. Six cases, all of them.

// drawEdgeMarker's retired body, verbatim.
function retiredDir(strand: number, edgeSide: number) {
  return strand === 0 ? edgeSide : strand
}
function retiredApexInset(strand: number, edgeSide: number) {
  return retiredDir(strand, edgeSide) === edgeSide ? 0 : CONT_TRI_W_PX
}

const CASES = [-1, 0, 1].flatMap(strand =>
  [1, -1].map(edgeSide => ({ strand, edgeSide })),
)

test('markerDirection matches the `strand === 0 ? edgeSide : strand` it replaced', () => {
  for (const { strand, edgeSide } of CASES) {
    expect(markerDirection(strand, edgeSide)).toBe(retiredDir(strand, edgeSide))
  }
})

test('the apex inset matches the `dir === edgeSide ? 0 : triW` it replaced', () => {
  for (const { strand, edgeSide } of CASES) {
    expect(CONT_TRI_W_PX * (1 - strandMatchesEdge(strand, edgeSide))).toBe(
      retiredApexInset(strand, edgeSide),
    )
  }
})

test('a strand-less feature points out of whichever edge it ran past', () => {
  // The property the `strand === 0` arm exists for. Its markers must read as
  // "keeps going that way" at both edges, so they point opposite ways there —
  // and never get the inward apex shift, since they are already outward.
  expect(markerDirection(0, 1)).toBe(1)
  expect(markerDirection(0, -1)).toBe(-1)
  expect(strandMatchesEdge(0, 1)).toBe(1)
  expect(strandMatchesEdge(0, -1)).toBe(1)
})

test('a marker pointing back inward is shifted, one pointing out is not', () => {
  // Forward feature at the right edge: runs the way it points, apex on the
  // anchor. At the left edge the same feature points back into view, so the
  // glyph is shifted inward to keep it inside the scissor.
  expect(strandMatchesEdge(1, 1)).toBe(1)
  expect(strandMatchesEdge(1, -1)).toBe(0)
  expect(strandMatchesEdge(-1, -1)).toBe(1)
  expect(strandMatchesEdge(-1, 1)).toBe(0)
})
