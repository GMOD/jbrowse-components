import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { getCoverageMenuItems } from './coverage.ts'

// Both rows scale or colour the coverage band and reach nothing else, and
// neither carries the band's visibility toggle, so with the band hidden they
// grey out and name the switch instead.
function menu(showCoverage: boolean, coverageSnpMinFrequency = 0) {
  return getCoverageMenuItems({
    id: 'd1',
    showCoverage,
    autoscaleRange: undefined,
    autoscaledDomain: undefined,
    coverageSnpMinFrequency,
    setCoverageSnpMinFrequency: () => {},
    scaleType: 'linear',
    scaleZero: true,
    domainQuantile: 1,
    clipQuantile: 0.99,
    manualMinScore: undefined,
    manualMaxScore: undefined,
    minScoreBound: undefined,
    maxScoreBound: undefined,
    hasManualScoreBounds: false,
    setScaleType: () => {},
    setScaleZero: () => {},
    setDomainQuantile: () => {},
    setMinScore: () => {},
    setMaxScore: () => {},
  })
}

test('the coverage rows grey out with the band hidden', () => {
  for (const row of menu(false)) {
    expect(row).toMatchObject({
      disabled: true,
      disabledHelpText: expect.stringContaining('Show coverage'),
    })
  }
})

test('the coverage rows are live with the band shown', () => {
  expect(menu(true).map(row => 'label' in row && row.label)).toEqual([
    'Coverage axis...',
    'Color SNPs above...',
  ])
  for (const row of menu(true)) {
    expect(row).toMatchObject({ disabled: false })
  }
})

// The floor is a plain number a config can declare, so it need not be one of the
// five offered fractions. The group still has to say which one is nearest, or a
// track configured at 0.15 renders five unticked rows over a floor that is in
// effect. Ties go to the lower row.
function tickedSnpFrequencyLabels(coverageSnpMinFrequency: number) {
  const group = menu(true, coverageSnpMinFrequency).find(
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
