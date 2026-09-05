import {
  markerDirection,
  strandMatchesEdge,
} from '../passes/shaders/continuation.js.generated.ts'
import { CONT_TRI_W_PX } from './sharedRendererConstants.ts'

// Screen strand is -1, 0 or +1 and edgeSide is ±1, so these six cases are the
// whole domain.
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
  expect(markerDirection(0, 1)).toBe(1)
  expect(markerDirection(0, -1)).toBe(-1)
  expect(strandMatchesEdge(0, 1)).toBe(1)
  expect(strandMatchesEdge(0, -1)).toBe(1)
})

test('a marker pointing back inward is shifted, one pointing out is not', () => {
  expect(strandMatchesEdge(1, 1)).toBe(1)
  expect(strandMatchesEdge(1, -1)).toBe(0)
  expect(strandMatchesEdge(-1, -1)).toBe(1)
  expect(strandMatchesEdge(-1, 1)).toBe(0)
})
