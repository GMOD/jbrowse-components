import { getContrastRatio } from '@mui/material/styles'

import { defaultRefNameColors } from '../../assemblyManager/refNameColors.ts'
import { makeContrasting } from './index.ts'

describe('makeContrasting', () => {
  test.each([
    ['#333333', '#ffffff'],
    ['#333333', '#121212'],
    ['rgb(255, 0, 204)', '#ffffff'],
  ])('reaches the target ratio for %s on %s', (fg, bg) => {
    expect(
      getContrastRatio(makeContrasting(fg, bg), bg),
    ).toBeGreaterThanOrEqual(3)
  })

  // Regression: the coefficient grew without bound while lighten/darken clamp it
  // at 1, so a background whose luminance makes 3:1 unreachable spun forever and
  // froze the render thread. #b0b0b0 (luminance 0.434) is the worst case.
  test.each(['#a0a0a0', '#b0b0b0'])(
    'terminates for every default refName color on %s',
    bg => {
      for (const color of defaultRefNameColors) {
        const out = makeContrasting(color, bg)
        expect(typeof out).toBe('string')
        // the best reachable ratio is below the 3:1 target here, so the closest
        // candidate is returned rather than looping
        expect(getContrastRatio(out, bg)).toBeGreaterThan(1)
      }
    },
  )

  test('returns a candidate at least as contrasting as the input', () => {
    const bg = '#b0b0b0'
    for (const color of defaultRefNameColors) {
      expect(
        getContrastRatio(makeContrasting(color, bg), bg),
      ).toBeGreaterThanOrEqual(getContrastRatio(color, bg))
    }
  })
})
