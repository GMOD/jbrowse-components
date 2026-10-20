import {
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
  denormalizeScore,
} from './scoreScale.ts'
import {
  denormalizeScore as shaderDenormalize,
  normalizeScoreUnclamped,
} from './shaders/scoreScale.js.generated.ts'

import type { ScaleTypeCode } from './scoreScale.ts'

// A line under a ramp reads the value at a fragment's height back through the
// y scale (`lineFragmentColor`), and Canvas2D cuts its bands in value space
// with scoreScale.ts's `denormalizeScore`. The shader's inverse has to agree
// with that one, and undo the shader's own normalizer.

const CASES: [string, [number, number], ScaleTypeCode, number][] = [
  ['linear', [-40, 60], 0, 1],
  ['log', [1, 1000], SCALE_TYPE_LOG, 1],
  ['log, domain under 1', [0.01, 0.5], SCALE_TYPE_LOG, 1],
  ['log, domain from 0', [0, 1000], SCALE_TYPE_LOG, 1],
  ['symlog', [-40, 60], SCALE_TYPE_SYMLOG, 1],
  ['symlog, wide constant', [0, 1000], SCALE_TYPE_SYMLOG, 20],
  ['no range', [5, 5], 0, 1],
]

const FRACTIONS = [-0.25, 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 1.25]

describe.each(CASES)('%s', (_, [min, max], scaleType, c) => {
  test.each(FRACTIONS)('at %p the shader matches scoreScale.ts', t => {
    const want = denormalizeScore(t, min, max, scaleType, c)
    expect(shaderDenormalize(t, min, max, scaleType, c)).toBeCloseTo(
      want,
      Math.abs(want) > 100 ? 2 : 4,
    )
  })

  // a log normalizer floors a score at the domain's min, so below it there is
  // nothing to undo
  if (max > min) {
    const undone =
      scaleType === SCALE_TYPE_LOG ? FRACTIONS.filter(t => t >= 0) : FRACTIONS
    test.each(undone)('at %p it undoes the normalizer', t => {
      const value = shaderDenormalize(t, min, max, scaleType, c)
      expect(
        normalizeScoreUnclamped(value, min, max, scaleType, c),
      ).toBeCloseTo(t, 4)
    })
  }
})
