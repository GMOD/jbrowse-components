import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { getCoverageMenuItem } from './coverage.ts'

// Every setting in this submenu scales the coverage band's draw and its hit
// test and reaches nothing else, and — unlike the sashimi and read-connection
// menus — it carries no visibility toggle of its own, so with the band hidden
// it is a submenu of controls with no way back. It greys out and names the
// switch instead.
function menu(showCoverage: boolean, coverageSnpMinFrequency = 0) {
  return getCoverageMenuItem({
    numStdDev: 3,
    showCoverage,
    coverageSnpMinFrequency,
    setCoverageSnpMinFrequency: () => {},
    scaleType: 'linear',
    autoscaleType: 'local',
    minScore: Number.MIN_VALUE,
    maxScore: Number.MAX_VALUE,
    minScoreBound: undefined,
    maxScoreBound: undefined,
    setScaleType: () => {},
    setAutoscale: () => {},
    setMinScore: () => {},
    setMaxScore: () => {},
  })
}

test('the coverage submenu greys out with the band hidden', () => {
  expect(menu(false)).toMatchObject({
    disabled: true,
    disabledHelpText: expect.stringContaining('Show coverage'),
  })
})

test('the coverage submenu is live with the band shown', () => {
  expect(menu(true)).toMatchObject({ disabled: false })
})

// Greying a row disables its pin along with it (`menuItemAdornment`), so a
// promotable row must never be gated. Nothing in here carries one today; this is
// what says so before a future promotable setting is added to the submenu rather
// than after a user finds its pin dead.
test('no row inside carries a pin', () => {
  const item = menu(true)
  const rows = 'subMenu' in item ? resolveSubMenu(item) : []
  for (const row of rows) {
    expect(row).not.toHaveProperty('pin')
  }
})

// The floor is a plain number a config can declare, so it need not be one of the
// five offered fractions. The group still has to say which one is nearest, or a
// track configured at 0.15 renders five unticked rows over a floor that is in
// effect. Ties go to the lower row.
function tickedSnpFrequencyLabels(coverageSnpMinFrequency: number) {
  const item = menu(true, coverageSnpMinFrequency)
  const rows = 'subMenu' in item ? resolveSubMenu(item) : []
  const group = rows.find(
    row => 'label' in row && row.label === 'Color SNPs above...',
  )
  const options = group && 'subMenu' in group ? resolveSubMenu(group) : []
  return options.flatMap(row =>
    'checked' in row && row.checked && 'label' in row ? [row.label] : [],
  )
}

test('an exact fraction ticks its own row', () => {
  expect(tickedSnpFrequencyLabels(0.05)).toEqual(['Above 5%'])
  expect(tickedSnpFrequencyLabels(0)).toEqual(['All mismatches'])
})

test('a fraction between two options ticks the nearest, ties low', () => {
  expect(tickedSnpFrequencyLabels(0.15)).toEqual(['Above 10%'])
  expect(tickedSnpFrequencyLabels(0.17)).toEqual(['Above 20%'])
  expect(tickedSnpFrequencyLabels(0.5)).toEqual(['Above 20%'])
  expect(tickedSnpFrequencyLabels(0.002)).toEqual(['All mismatches'])
})
