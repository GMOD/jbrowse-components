import { getSnpViewportX } from './snpViewportX.ts'

const assembly = { getCanonicalRefName2: (refName: string) => refName }
const snp = { refName: 'chr1', start: 1000 }

test('subtracts raw offsetPx (viewport-relative x)', () => {
  const view = { offsetPx: 30, bpToPx: () => ({ offsetPx: 100 }) }
  expect(getSnpViewportX(view, assembly, snp)).toBe(70)
})

test('scrolled left of genome start (offsetPx < 0) does NOT clamp', () => {
  // the regression this guards: clamping offsetPx to 0 here would drop the
  // |offsetPx| gap that the render frame (viewOffsetX) already carries,
  // misaligning the label/connector from the matrix by |offsetPx|
  const view = { offsetPx: -50, bpToPx: () => ({ offsetPx: 100 }) }
  expect(getSnpViewportX(view, assembly, snp)).toBe(150)
})

test('missing bpToPx result falls back to 0 before applying offset', () => {
  const view = { offsetPx: 40, bpToPx: () => undefined }
  expect(getSnpViewportX(view, assembly, snp)).toBe(-40)
})
