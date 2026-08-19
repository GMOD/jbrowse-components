import {
  SCALE_TYPE_SYMLOG,
  makeScoreNormalizer,
  resolveSymlogConstant,
} from './normalize.ts'
import { getNiceDomain, getOrigin, getScale } from './scale.ts'

// What symlog is FOR, as opposed to how it is wired. `log` cannot hold a domain
// that reaches zero — `getNiceDomain` floors it away, and the normalizer floors
// again — so a track whose scores touch 0 either loses the zero or loses the
// log. These pin the escape from that, including the trap the `symlogConstant`
// slot exists to let people out of.

const noBounds: [undefined, undefined] = [undefined, undefined]

describe('a domain that reaches zero', () => {
  test('log floors it away, symlog keeps it', () => {
    expect(
      getNiceDomain({
        scaleType: 'log',
        domain: [0, 1000],
        bounds: noBounds,
      })[0],
    ).toBe(1)
    expect(
      getNiceDomain({
        scaleType: 'symlog',
        domain: [0, 1000],
        bounds: noBounds,
      })[0],
    ).toBe(0)
  })

  test('bars grow from 0, not from 1', () => {
    expect(getOrigin('log')).toBe(1)
    expect(getOrigin('symlog')).toBe(0)
  })

  test('zero sits on the baseline and nothing else does', () => {
    const c = resolveSymlogConstant(0, 1000, 0)
    const normalize = makeScoreNormalizer(0, 1000, SCALE_TYPE_SYMLOG, c)
    expect(normalize(0)).toBe(0)
    // a single read is distinguishable from no reads, which is the thing the
    // log branch's floor-at-1 collapses
    expect(normalize(1)).toBeGreaterThan(0)
    expect(normalize(1)).toBeLessThan(normalize(10))
  })
})

describe('a domain that crosses zero', () => {
  test('log cannot express one, symlog puts 0 up the plot', () => {
    const domain = getNiceDomain({
      scaleType: 'symlog',
      domain: [-40, 60],
      bounds: noBounds,
    })
    const c = resolveSymlogConstant(domain[0], domain[1], 0)
    const normalize = makeScoreNormalizer(
      domain[0],
      domain[1],
      SCALE_TYPE_SYMLOG,
      c,
    )
    const atZero = normalize(0)
    expect(atZero).toBeGreaterThan(0)
    expect(atZero).toBeLessThan(1)
    expect(normalize(-40)).toBeLessThan(atZero)
    expect(normalize(60)).toBeGreaterThan(atZero)
  })
})

describe('the symlog constant is why this is not just log(x+1)', () => {
  // A p-value-ish domain: everything interesting lives below 1, which is
  // exactly where log(x+1) has no resolution left to spend.
  const domain: [number, number] = [0, 1]

  test('constant 1 is log(x+1) and flattens the domain to linear', () => {
    const normalize = makeScoreNormalizer(0, 1, SCALE_TYPE_SYMLOG, 1)
    // log1p is very nearly linear across [0,1], so the small end gets no more
    // of the axis than a linear scale would have given it
    const linear = makeScoreNormalizer(0, 1, 0)
    expect(normalize(0.01)).toBeCloseTo(linear(0.01), 2)
  })

  test('the resolved default spreads the small end out instead', () => {
    const c = resolveSymlogConstant(domain[0], domain[1], 0)
    expect(c).toBe(0.001)
    const normalize = makeScoreNormalizer(0, 1, SCALE_TYPE_SYMLOG, c)
    const linear = makeScoreNormalizer(0, 1, 0)
    // 0.01 is 1% of the way up a linear axis; symlog gives it a third of one
    expect(normalize(0.01)).toBeGreaterThan(10 * linear(0.01))
    expect(normalize(0.0001)).toBeGreaterThan(0)
  })

  test('an explicit constant wins over the derived one', () => {
    expect(resolveSymlogConstant(0, 1000, 2)).toBe(2)
    expect(resolveSymlogConstant(0, 1000, 0)).toBe(1)
  })
})

describe('the axis is built with the same constant', () => {
  test('getScale and makeScoreNormalizer agree across the domain', () => {
    const domain: [number, number] = [0, 500]
    const c = resolveSymlogConstant(domain[0], domain[1], 0)
    const scale = getScale({
      domain,
      range: [100, 0],
      scaleType: 'symlog',
      nice: false,
    })
    const normalize = makeScoreNormalizer(
      domain[0],
      domain[1],
      SCALE_TYPE_SYMLOG,
      c,
    )
    for (const score of [0, 0.5, 1, 10, 100, 500]) {
      expect(scale(score)).toBeCloseTo(100 * (1 - normalize(score)), 6)
    }
  })
})
