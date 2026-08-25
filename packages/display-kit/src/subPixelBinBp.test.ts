import { MIN_BINNED_BP_PER_PX, subPixelBinBp } from './subPixelBinBp.ts'

describe('subPixelBinBp', () => {
  test('visits every base until a base is half a pixel wide', () => {
    expect(subPixelBinBp(0.1)).toBe(1)
    expect(subPixelBinBp(1)).toBe(1)
    expect(subPixelBinBp(3.9)).toBe(1)
  })

  test('the first bin is 2bp, so no base wider than half a pixel is dropped', () => {
    expect(subPixelBinBp(MIN_BINNED_BP_PER_PX)).toBe(2)
  })

  test('quantizes to a power of two, so a zoom nudge holds the bin', () => {
    expect(subPixelBinBp(4)).toBe(2)
    expect(subPixelBinBp(7.9)).toBe(2)
    expect(subPixelBinBp(8)).toBe(4)
    expect(subPixelBinBp(333)).toBe(128)
  })

  test('a bin never exceeds half a pixel', () => {
    for (let bpPerPx = 0.25; bpPerPx < 100000; bpPerPx *= 1.07) {
      const binBp = subPixelBinBp(bpPerPx)
      expect(binBp).toBeLessThanOrEqual(Math.max(1, bpPerPx / 2))
      expect(Math.log2(binBp) % 1).toBe(0)
    }
  })
})
