import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_SYMLOG,
  makeScoreNormalizer,
  resolveSymlogConstant,
} from './normalize.ts'
import {
  parseScoreRules,
  scoreRuleMarks,
  widenRangeToRules,
} from './scoreRuleMarks.ts'
import { axisPlotBox } from './yScaleTicks.ts'

const linear = (min: number, max: number) =>
  makeScoreNormalizer(min, max, SCALE_TYPE_LINEAR)

describe('parseScoreRules', () => {
  test('takes bare numbers and objects, drops the unusable', () => {
    expect(
      parseScoreRules([
        30,
        { value: 15, label: '1 copy' },
        { value: '45', color: 'red' },
        { label: 'no value' },
        { value: 'abc' },
        { value: Number.NaN },
        null,
        'nope',
      ]),
    ).toEqual([
      { value: 30 },
      { value: 15, label: '1 copy' },
      { value: 45, color: 'red' },
    ])
  })

  test('a non-array config is no rules, not a crash', () => {
    expect(parseScoreRules(undefined)).toEqual([])
    expect(parseScoreRules({ value: 3 })).toEqual([])
  })
})

describe('scoreRuleMarks', () => {
  const height = 100
  const domain: [number, number] = [0, 60]

  test('places a rule where its score sits on the axis', () => {
    const [mark] = scoreRuleMarks({
      rules: [{ value: 30, label: '2 copies' }],
      domain,
      box: axisPlotBox(height),
      normalize: linear(0, 60),
    })
    const box = axisPlotBox(height)
    // halfway up the plot box, because 30 is halfway up [0,60]
    expect(mark!.y).toBeCloseTo((box.yTop + box.yBottom) / 2, 6)
    expect(mark!.label).toBe('2 copies')
  })

  // Carried over from GWAS's significanceLine, which this replaced: the ends of
  // the domain have to reach the ends of the plot box, and the bottom one is
  // clamped a stroke inside the axis the same way a tick is, so a rule at the
  // domain minimum cannot render half outside the plot.
  test('puts the domain ends at the plot box ends', () => {
    const box = axisPlotBox(height)
    const at = (value: number) =>
      scoreRuleMarks({
        rules: [{ value }],
        domain,
        box,
        normalize: linear(0, 60),
      })[0]!.y
    expect(at(60)).toBeCloseTo(box.yTop, 6)
    expect(at(0)).toBeLessThanOrEqual(box.yBottom)
    expect(at(0)).toBeGreaterThan(box.yBottom - 2)
  })

  test('drops rules outside the domain rather than pinning them to an edge', () => {
    const marks = scoreRuleMarks({
      rules: [{ value: -5 }, { value: 30 }, { value: 500 }],
      domain,
      box: axisPlotBox(height),
      normalize: linear(0, 60),
    })
    expect(marks.map(m => m.value)).toEqual([30])
  })

  test('a degenerate domain places nothing', () => {
    expect(
      scoreRuleMarks({
        rules: [{ value: 5 }],
        domain: [5, 5],
        box: axisPlotBox(height),
        normalize: linear(5, 5),
      }),
    ).toEqual([])
  })

  // The reason `normalize` is a parameter rather than a linear read of the
  // domain: on a non-linear axis the two disagree, and a rule that ignores the
  // scale sits somewhere the data it is read against is not.
  test('follows a symlog axis rather than interpolating the domain', () => {
    const c = resolveSymlogConstant(0, 100, 0)
    const [mark] = scoreRuleMarks({
      rules: [{ value: 1 }],
      domain: [0, 100],
      box: axisPlotBox(height),
      normalize: makeScoreNormalizer(0, 100, SCALE_TYPE_SYMLOG, c),
    })
    const box = axisPlotBox(height)
    const linearY = scoreRuleMarks({
      rules: [{ value: 1 }],
      domain: [0, 100],
      box: axisPlotBox(height),
      normalize: linear(0, 100),
    })[0]!.y
    // symlog lifts a depth of 1 well up the plot; linear leaves it on the floor
    expect(mark!.y).toBeLessThan(linearY - 0.2 * (box.yBottom - box.yTop))
  })
})

describe('widenRangeToRules', () => {
  test('reaches a rule above the data, and one below it', () => {
    expect(widenRangeToRules([0, 10], [30])).toEqual([0, 30])
    expect(widenRangeToRules([0, 10], [-4])).toEqual([-4, 10])
  })

  test('leaves a range that already covers every rule alone', () => {
    expect(widenRangeToRules([0, 60], [15, 30])).toEqual([0, 60])
  })

  test('ignores a non-finite rule rather than poisoning the range', () => {
    expect(
      widenRangeToRules([0, 10], [Number.NaN, Number.POSITIVE_INFINITY]),
    ).toEqual([0, 10])
  })
})
