import { DEFAULT_GAP_BREAK_MULTIPLE, gapBreakLimit } from './gapBreak.ts'

describe('gapBreakLimit', () => {
  test('scales the limit to the series mean spacing', () => {
    // 11 points spanning 0..1000 => mean spacing 100
    expect(
      gapBreakLimit({ first: 0, last: 1000, count: 11, multiple: 5 }),
    ).toBe(500)
  })

  test('is zoom-invariant: widening every bin widens the limit in step', () => {
    const zoomedIn = gapBreakLimit({
      first: 0,
      last: 1000,
      count: 11,
      multiple: 5,
    })
    const zoomedOut = gapBreakLimit({
      first: 0,
      last: 10000,
      count: 11,
      multiple: 5,
    })
    expect(zoomedOut / zoomedIn).toBe(10)
  })

  test('multiple <= 0 disables breaking', () => {
    for (const multiple of [0, -1]) {
      expect(gapBreakLimit({ first: 0, last: 1000, count: 11, multiple })).toBe(
        Number.POSITIVE_INFINITY,
      )
    }
  })

  // Two points have no "typical" spacing for a third to be unusual against, so
  // there is nothing that could count as a hole.
  test('fewer than three points never breaks', () => {
    for (const count of [0, 1, 2]) {
      expect(gapBreakLimit({ first: 0, last: 1000, count, multiple: 5 })).toBe(
        Number.POSITIVE_INFINITY,
      )
    }
  })

  test('a degenerate series (no extent) never breaks', () => {
    expect(gapBreakLimit({ first: 50, last: 50, count: 9, multiple: 5 })).toBe(
      Number.POSITIVE_INFINITY,
    )
  })

  // THE DEFAULT IS OFF, and these two tests pin the calibrated value (20) that
  // a track has to name to turn breaking back on. Written as a literal rather
  // than as DEFAULT_GAP_BREAK_MULTIPLE so that flipping the default back does
  // not silently change what they measure.
  const CALIBRATED = 20

  test('the default multiple is off, so nothing breaks', () => {
    expect(
      gapBreakLimit({
        first: 500,
        last: 100_500,
        count: 101,
        multiple: DEFAULT_GAP_BREAK_MULTIPLE,
      }),
    ).toBe(Number.POSITIVE_INFINITY)
  })

  // bbi's reduced zoom levels emit fixed-width summary bins, so a wiggle series
  // tiles: every gap sits at exactly 1x the mean. Measured on
  // volvox_microarray.bw (500 bins, max gap 1.0x) at three zooms, which is why
  // the calibrated multiple could be enabled for every track without touching
  // one that has no holes.
  test('uniformly tiled bins never break, at the calibrated multiple', () => {
    const limit = gapBreakLimit({
      first: 50,
      last: 49_950,
      count: 500,
      multiple: CALIBRATED,
    })
    expect(100).toBeLessThanOrEqual(limit)
  })

  // The calibrated multiple has to clear the sporadic non-tiling bins reduced
  // BigWig data is full of (a bin or two skipped, so ~2-3x the mean) while still
  // catching an unmappable stretch, which runs orders of magnitude past it.
  test('the calibrated multiple clears jitter but catches a real hole', () => {
    // 1kb bins over 100kb, i.e. mean spacing 1000
    const limit = gapBreakLimit({
      first: 500,
      last: 100_500,
      count: 101,
      multiple: CALIBRATED,
    })
    expect(3000).toBeLessThanOrEqual(limit) // two skipped bins: still connected
    expect(500_000).toBeGreaterThan(limit) // a 500kb hole: broken
  })
})
