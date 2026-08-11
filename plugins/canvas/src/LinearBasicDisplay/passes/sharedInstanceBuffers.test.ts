import {
  ARROW_PASS,
  ArrowPass,
  CHEVRON_PASS,
  CONTINUATION_PASS,
  ContinuationPass,
  LINE_PASS,
  LinePass,
  RECT_PASS,
  RectPass,
  makeChevronPass,
} from './index.ts'
import * as arrowIface from './shaders/arrow.iface.generated.ts'
import * as chevronIface from './shaders/chevron.iface.generated.ts'
import * as continuationIface from './shaders/continuation.iface.generated.ts'
import * as lineIface from './shaders/line.iface.generated.ts'
import * as rectIface from './shaders/rect.iface.generated.ts'

import type { PipelineDescriptor } from '@jbrowse/render-core/hal'

// Two of the five feature-glyph passes draw from ANOTHER pass's vertex buffer
// (`drawPass(id, region, bufferPassId)`): chevron reads line's, continuation
// reads rect's. That works only while the borrowing shader declares byte-for-
// byte the same attributes the lending one does — the WebGPU HAL derives
// `shaderLocation` from the lender's VERTEX_ATTRIBUTES *index*, so a field
// inserted on one side alone silently re-points every later attribute at the wrong
// offset. Nothing throws: the glyphs just come out drawn from garbage, on GPU
// machines only, and never in a Canvas2D-backed test.
//
// `lineInstance.slang` / `rectInstance.slang` are what make that impossible —
// one struct declaration, imported by both shaders of each pair. These
// assertions are the check that the arrangement is still in place, i.e. that
// nobody has re-declared a local struct in one of the four shaders.

const SHARED_LAYOUT_PAIRS = [
  { lender: 'line', borrower: 'chevron', a: lineIface, b: chevronIface },
  {
    lender: 'rect',
    borrower: 'continuation',
    a: rectIface,
    b: continuationIface,
  },
] as const

describe.each(SHARED_LAYOUT_PAIRS)(
  '$borrower draws from $lender’s instance buffer',
  ({ a, b }) => {
    it('agrees on the instance stride', () => {
      expect(b.INSTANCE_STRIDE_BYTES).toBe(a.INSTANCE_STRIDE_BYTES)
    })

    it('agrees on every attribute name, type and offset, in order', () => {
      expect(b.VERTEX_ATTRIBUTES).toStrictEqual(a.VERTEX_ATTRIBUTES)
    })
  },
)

// The pass descriptors are the other half. `slangPass` takes each pass's layout
// from its own module and deliberately offers no override to copy the lender's
// onto it (an override would restate the agreement rather than cause it, and
// would hide the structs drifting apart) — so what reaches the HAL is only ever
// as right as the shared struct makes it. Assert that at the descriptor level
// too, since that is the object the HAL binds from.
describe('pass descriptors carry the lender’s buffer layout', () => {
  const byId = new Map<string, PipelineDescriptor>([
    [RECT_PASS, RectPass],
    [LINE_PASS, LinePass],
    [ARROW_PASS, ArrowPass],
    [CHEVRON_PASS, makeChevronPass(8)],
    [CONTINUATION_PASS, ContinuationPass],
  ])

  it.each([
    [CHEVRON_PASS, LINE_PASS],
    [CONTINUATION_PASS, RECT_PASS],
  ])('%s uses %s’s stride and attributes', (borrower, lender) => {
    const borrowed = byId.get(borrower)!
    const lent = byId.get(lender)!
    expect(borrowed.instanceStride).toBe(lent.instanceStride)
    expect(borrowed.vertexAttributes).toStrictEqual(lent.vertexAttributes)
  })

  it('gives each pass its own vertex count', () => {
    // The shared buffer is per-instance data, not geometry: chevron expands one
    // line into many chevrons and continuation one rect into four arrowheads, so
    // borrowing the buffer must not mean borrowing verticesPerInstance.
    expect(byId.get(CHEVRON_PASS)!.verticesPerInstance).toBe(8 * 12)
    expect(byId.get(CONTINUATION_PASS)!.verticesPerInstance).toBe(
      continuationIface.VERTS_PER_INSTANCE,
    )
    expect(byId.get(RECT_PASS)!.verticesPerInstance).toBe(
      rectIface.VERTS_PER_INSTANCE,
    )
    expect(byId.get(ARROW_PASS)!.verticesPerInstance).toBe(
      arrowIface.VERTS_PER_INSTANCE,
    )
  })
})
