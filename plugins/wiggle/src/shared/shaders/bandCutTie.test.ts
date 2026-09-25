import {
  normalizeScore,
  normalizeScoreUnclamped,
} from '@jbrowse/render-core/shaders/scoreScale'
import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
  makeScoreNormalizer,
} from '@jbrowse/wiggle-core'

import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'

// A line plot colours by the band its centre line is in, and `bandColorAt`
// decides that with `centerLineYPx <= cutY`. So a bin scoring EXACTLY a
// threshold's cut sits on the boundary, and which side it lands on is an exact
// float equality: the score's y and the cut's y are two evaluations of
// scoreScale.slang's normalize, and they tie only because the GPU runs both.
//
// That is what stops the obvious optimization. `cutYsPx` loops every cut
// through the normalizer once PER VERTEX — 18 vertices an instance for the step
// line — recomputing numbers derived from uniforms alone, and the tree already
// ships one pre-normalized uniform, `rampMidNorm`, to generalize from. But
// `rampMidNorm` only positions a ramp; nothing is ever compared to it. A cut is
// compared, and moving one side of that comparison to the JS side breaks it two
// ways: `makeScoreNormalizer` hoists a reciprocal the shader divides by
// (adr-051, "hoisting a reciprocal is a numeric choice, not just a speed one"),
// and a GPU's log2/log carry an error budget JS does not. The second is not
// reproducible here; the first is, and it is enough — see the sabotage below.
//
// SYNC: keep in step with wiggleCommon.slang's `rowScoreToYPx`, `rowCutToYPx`
// and `bandColorAt`. The out-of-domain half of the placement rule is
// wiggleMarksPaint.test.ts §"a cut outside the domain parts nothing".

const ROW_HEIGHT = 100
const ROW_TOP = 37

function rowScoreToYPx(
  score: number,
  min: number,
  max: number,
  scaleType: ScaleTypeCode,
  symlogConstant: number,
) {
  const norm = normalizeScore(score, min, max, scaleType, symlogConstant)
  return (1 - norm) * ROW_HEIGHT + ROW_TOP
}

function rowCutToYPx(
  cut: number,
  min: number,
  max: number,
  scaleType: ScaleTypeCode,
  symlogConstant: number,
) {
  const norm = normalizeScoreUnclamped(cut, min, max, scaleType, symlogConstant)
  return (1 - norm) * ROW_HEIGHT + ROW_TOP
}

function bandAt(centerLineYPx: number, cutYs: number[]) {
  let band = 0
  for (const [i, cutY] of cutYs.entries()) {
    if (centerLineYPx <= cutY) {
      band = i + 1
    }
  }
  return band
}

interface Domain {
  name: string
  scaleType: ScaleTypeCode
  min: number
  max: number
  symlogConstant: number
  cuts: number[]
}

// Domains a display reaches, each with in-domain cuts a config would name.
const DOMAINS: Domain[] = [
  {
    name: 'linear',
    scaleType: SCALE_TYPE_LINEAR,
    min: 0,
    max: 20,
    symlogConstant: 1,
    cuts: [5, 7, 13.7],
  },
  {
    name: 'linear crossing zero',
    scaleType: SCALE_TYPE_LINEAR,
    min: -40,
    max: 60,
    symlogConstant: 1,
    cuts: [-7, 0, 25],
  },
  {
    name: 'log',
    scaleType: SCALE_TYPE_LOG,
    min: 1,
    max: 1000,
    symlogConstant: 1,
    cuts: [3, 10, 777],
  },
  {
    name: 'symlog crossing zero',
    scaleType: SCALE_TYPE_SYMLOG,
    min: -40,
    max: 60,
    symlogConstant: 10,
    cuts: [-7, 0, 25],
  },
  {
    name: 'symlog reaching zero',
    scaleType: SCALE_TYPE_SYMLOG,
    min: 0,
    max: 1000,
    symlogConstant: 1,
    cuts: [10, 137, 999],
  },
]

describe.each(DOMAINS)(
  '$name',
  ({ scaleType, min, max, symlogConstant, cuts }) => {
    const cutYs = cuts.map(cut =>
      rowCutToYPx(cut, min, max, scaleType, symlogConstant),
    )

    it.each(cuts)('a bin scoring exactly %p is at or past that cut', score => {
      const y = rowScoreToYPx(score, min, max, scaleType, symlogConstant)
      expect(bandAt(y, cutYs)).toBe(cuts.indexOf(score) + 1)
    })
  },
)

// The sabotage the comment above owes: a `cuts` uniform arriving already
// normalized, through the factory that hoists the log domain and the reciprocal
// out of a per-feature loop. That factory is the natural JS side of the change
// — it is what `rampMidNorm` is written through — and it costs the tie on the
// DEFAULT scale, on a round domain, at a round cut.
test('a pre-normalized cut loses the tie', () => {
  const min = 0
  const max = 20
  const cut = 7
  const y = rowScoreToYPx(cut, min, max, SCALE_TYPE_LINEAR, 1)
  const hoisted = makeScoreNormalizer(min, max, SCALE_TYPE_LINEAR, 1)

  expect(bandAt(y, [rowCutToYPx(cut, min, max, SCALE_TYPE_LINEAR, 1)])).toBe(1)
  expect(bandAt(y, [(1 - hoisted(cut)) * ROW_HEIGHT + ROW_TOP])).toBe(0)
})
