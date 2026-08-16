import { bucketBpPerPx } from './bpPerPxBucket.ts'

test('a bucket spans one doubling', () => {
  expect(bucketBpPerPx(1024)).toBe(bucketBpPerPx(2047))
  expect(bucketBpPerPx(1024)).not.toBe(bucketBpPerPx(2048))
})

// The margin the dotplot fetch relies on: held data can be zoomed into by at
// most one bucket-width before the key refires, and dotplot's ZOOM_HEADROOM —
// how far past the CIGAR-ship threshold the worker parses — is 8x.
test('a bucket admits at most a 2x zoom against held data', () => {
  for (let bpPerPx = 1; bpPerPx < 1e6; bpPerPx *= 1.07) {
    const lo = 2 ** bucketBpPerPx(bpPerPx)
    expect(bpPerPx / lo).toBeLessThan(2)
  }
})

// Below 1bp/px every alignment on screen is wide enough to be worth its CIGAR,
// so there is nothing left for the term to decide and the floor collapses them.
test('sub-bp/px zooms share one bucket', () => {
  expect(bucketBpPerPx(0.02)).toBe(bucketBpPerPx(1))
})
