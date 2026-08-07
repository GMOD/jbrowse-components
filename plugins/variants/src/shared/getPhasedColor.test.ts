import { featureHasPhaseSet, getPhasedColor } from './getPhasedColor.ts'

// Everything downstream of this color memoizes on the *string* it returns —
// `getCachedABGR` keys a module-level Map that never evicts, in a worker that
// outlives every fetch. An unrounded hue made that string unique per phase set,
// so a whole-genome phased callset interned one entry (and one colord parse) per
// PS. Whole degrees bound it to the size of the hue wheel.
test('a phase-set hue is a whole degree, so the color strings are bounded', () => {
  const colors = new Set<string>()
  for (let ps = 1; ps <= 50000; ps++) {
    colors.add(getPhasedColor(['1', '0'], 0, '1', String(ps)))
  }
  expect(colors.size).toBeLessThanOrEqual(361)
})

test('consecutive phase sets still land far apart on the wheel', () => {
  // the golden-angle multiplier is what does this; rounding must not collapse
  // neighbours onto each other
  const hue = (ps: number) =>
    Number(
      /hsl\((\d+)/.exec(getPhasedColor(['1', '0'], 0, '1', String(ps)))![1],
    )
  for (let ps = 1; ps < 20; ps++) {
    const gap = Math.abs(hue(ps + 1) - hue(ps))
    expect(Math.min(gap, 360 - gap)).toBeGreaterThan(100)
  }
})

test('a non-numeric phase set falls back to hue 0 rather than NaN', () => {
  expect(getPhasedColor(['1', '0'], 0, '1', 'notanumber')).toBe(
    'hsl(0, 50%, 50%)',
  )
})

// FORMAT is a colon-separated field list, so the PS test has to be an exact
// token match. A substring test enabled "Color by...→Phase set" on files whose
// FORMAT merely spells those two letters inside another field name, where the
// coloring then found no PS on any sample and silently painted allele colors.
describe('featureHasPhaseSet', () => {
  it('matches the PS field wherever it sits in FORMAT', () => {
    expect(featureHasPhaseSet('GT:AD:DP:GQ:PL:PS')).toBe(true)
    expect(featureHasPhaseSet('PS:GT')).toBe(true)
    expect(featureHasPhaseSet('PS')).toBe(true)
  })

  it('does not match a field merely containing PS', () => {
    expect(featureHasPhaseSet('GT:PSL')).toBe(false)
    expect(featureHasPhaseSet('GT:APS')).toBe(false)
  })

  it('is false for a sites-only record with no FORMAT', () => {
    expect(featureHasPhaseSet(undefined)).toBe(false)
    expect(featureHasPhaseSet('')).toBe(false)
  })
})
