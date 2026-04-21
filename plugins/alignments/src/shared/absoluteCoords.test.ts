// Sanity tests that absolute-coordinate worker output maps correctly to
// pixel/clip space for both forward and reversed regions. Models the
// Canvas2D `bpToScreenX` and the GPU `hpClipX + flipX` pipeline in JS so
// we can assert on numeric output.

describe('absolute coords → pixel mapping, forward vs reversed', () => {
  // Canvas2D: identical shape to Canvas2DAlignmentsRenderer.bpToScreenX
  function canvas2dBpToScreenX(
    absBp: number,
    bpRangeX: [number, number],
    screenStartPx: number,
    fullBlockWidth: number,
    reversed: boolean,
  ) {
    const bpLen = bpRangeX[1] - bpRangeX[0]
    const bpEdge = reversed ? bpRangeX[1] : bpRangeX[0]
    const offset = reversed ? bpEdge - absBp : absBp - bpEdge
    return screenStartPx + (offset / bpLen) * fullBlockWidth
  }

  // GPU: (abs - start) / bpLen * 2 - 1 for clip-x, then flipX negates on reversed
  function gpuClipX(absBp: number, start: number, bpLen: number, reversed: boolean) {
    const clip = ((absBp - start) / bpLen) * 2 - 1
    return reversed ? -clip : clip
  }

  const bpRange: [number, number] = [1000, 2000]
  const blockWidth = 200 // screen px

  test('forward region: start → left edge, end → right edge', () => {
    expect(canvas2dBpToScreenX(1000, bpRange, 0, blockWidth, false)).toBe(0)
    expect(canvas2dBpToScreenX(2000, bpRange, 0, blockWidth, false)).toBe(200)
    expect(canvas2dBpToScreenX(1500, bpRange, 0, blockWidth, false)).toBe(100)
  })

  test('reversed region: start → right edge, end → left edge', () => {
    expect(canvas2dBpToScreenX(1000, bpRange, 0, blockWidth, true)).toBe(200)
    expect(canvas2dBpToScreenX(2000, bpRange, 0, blockWidth, true)).toBe(0)
    expect(canvas2dBpToScreenX(1500, bpRange, 0, blockWidth, true)).toBe(100)
  })

  test('GPU clip-x: forward maps start→-1, end→+1', () => {
    expect(gpuClipX(1000, 1000, 1000, false)).toBe(-1)
    expect(gpuClipX(2000, 1000, 1000, false)).toBe(1)
    expect(gpuClipX(1500, 1000, 1000, false)).toBe(0)
  })

  test('GPU clip-x: reversed maps start→+1, end→-1 (via flipX)', () => {
    expect(gpuClipX(1000, 1000, 1000, true)).toBe(1)
    expect(gpuClipX(2000, 1000, 1000, true)).toBe(-1)
    expect(gpuClipX(1500, 1000, 1000, true)).toBeCloseTo(0)
  })

  test('Canvas2D and GPU agree on visual midpoint regardless of orientation', () => {
    for (const reversed of [false, true]) {
      for (const bp of [1100, 1500, 1900]) {
        const canvasFrac =
          canvas2dBpToScreenX(bp, bpRange, 0, blockWidth, reversed) / blockWidth
        const gpuFrac = (gpuClipX(bp, bpRange[0], bpRange[1] - bpRange[0], reversed) + 1) / 2
        expect(canvasFrac).toBeCloseTo(gpuFrac)
      }
    }
  })

  test('absolute bp beyond region maps outside block in both orientations', () => {
    // bp=500 is 500 before start
    const fwd = canvas2dBpToScreenX(500, bpRange, 0, blockWidth, false)
    const rev = canvas2dBpToScreenX(500, bpRange, 0, blockWidth, true)
    expect(fwd).toBeLessThan(0)
    expect(rev).toBeGreaterThan(blockWidth)
  })
})
