import { getPhasedColor } from './getPhasedColor.ts'

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
