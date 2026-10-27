import * as chevronIface from './shaders/chevron.iface.generated.ts'
import * as continuationIface from './shaders/continuation.iface.generated.ts'
import * as lineIface from './shaders/line.iface.generated.ts'
import * as rectIface from './shaders/rect.iface.generated.ts'

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
