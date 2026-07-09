import { isIndexSnpOffscreen } from './isIndexSnpOffscreen.ts'

// chr:bp is 1-based; a visible region [1000,2000) covers PLINK bp 1001..2000.
const visible = [{ refName: '1', start: 1000, end: 2000 }]

test('in-region locus is not off-screen', () => {
  expect(isIndexSnpOffscreen('1:1500', visible)).toBe(false)
})

test('locus left or right of the visible region is off-screen', () => {
  expect(isIndexSnpOffscreen('1:500', visible)).toBe(true)
  expect(isIndexSnpOffscreen('1:9000', visible)).toBe(true)
})

test('respects the 1-based to 0-based boundary', () => {
  // bp 1000 -> 0-based 999, just left of the region
  expect(isIndexSnpOffscreen('1:1000', visible)).toBe(true)
  // bp 1001 -> 0-based 1000, the first covered base
  expect(isIndexSnpOffscreen('1:1001', visible)).toBe(false)
})

test('a locus on another refName is off-screen', () => {
  expect(isIndexSnpOffscreen('2:1500', visible)).toBe(true)
})

test('a bare rsID or missing index is never reported off-screen', () => {
  expect(isIndexSnpOffscreen('rs123', visible)).toBe(false)
  expect(isIndexSnpOffscreen(undefined, visible)).toBe(false)
})
