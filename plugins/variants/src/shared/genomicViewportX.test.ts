import { genomicViewportX } from './genomicViewportX.ts'

const assembly = { getCanonicalRefName2: (refName: string) => refName }

test('subtracts raw offsetPx (viewport-relative x)', () => {
  const view = { offsetPx: 30, bpToPx: () => ({ offsetPx: 100 }) }
  expect(genomicViewportX(view, assembly, 'chr1', 1000)).toBe(70)
})

test('scrolled left of genome start (offsetPx < 0) does NOT clamp', () => {
  // the regression this guards: clamping offsetPx to 0 here would drop the
  // |offsetPx| gap that the render frame (viewOffsetX) already carries,
  // misaligning the label/connector from the matrix by |offsetPx|
  const view = { offsetPx: -50, bpToPx: () => ({ offsetPx: 100 }) }
  expect(genomicViewportX(view, assembly, 'chr1', 1000)).toBe(150)
})

test('a locus with no on-screen x has no coordinate at all', () => {
  // falling back to 0 drew a line to the left edge of the view and skewed the
  // field's density-derived alpha; callers drop the line instead
  const view = { offsetPx: 40, bpToPx: () => undefined }
  expect(genomicViewportX(view, assembly, 'chr1', 1000)).toBeUndefined()
})
