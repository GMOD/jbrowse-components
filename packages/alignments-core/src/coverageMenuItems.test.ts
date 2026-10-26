import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { getCoverageMenuItems } from './coverageMenuItems.ts'

const ALLELES = 'Coverage mismatch threshold'

// Both rows scale or color the coverage band and reach nothing else, and
// neither carries the band's visibility toggle, so with the band hidden they
// grey out and name the switch instead.
function menu(
  showCoverage: boolean,
  minAlleleFraction = 0,
  showCoverageAlleles = true,
) {
  const state = { showCoverageAlleles, minAlleleFraction }
  const items = getCoverageMenuItems({
    id: 'd1',
    showCoverage,
    showCoverageAlleles,
    setShowCoverageAlleles: show => {
      state.showCoverageAlleles = show
    },
    autoscaleRange: undefined,
    autoscaledDomain: undefined,
    coverageMinAlleleFraction: minAlleleFraction,
    setCoverageMinAlleleFraction: fraction => {
      state.minAlleleFraction = fraction
    },
    scaleType: 'linear',
    scaleZero: true,
    fenceQuantile: 1,
    clipFenceQuantile: 0.99,
    manualMinScore: undefined,
    manualMaxScore: undefined,
    minScoreBound: undefined,
    maxScoreBound: undefined,
    hasManualScoreBounds: false,
    setScaleType: () => {},
    setScaleZero: () => {},
    setFenceQuantile: () => {},
    setMinScore: () => {},
    setMaxScore: () => {},
  })
  return Object.assign(items, { state })
}

function alleleRows(items: ReturnType<typeof menu>) {
  const group = items.find(row => 'label' in row && row.label === ALLELES)
  return group && 'subMenu' in group ? resolveSubMenu(group) : []
}

function tickedLabels(items: ReturnType<typeof menu>) {
  return alleleRows(items).flatMap(row =>
    'checked' in row && row.checked && 'label' in row ? [row.label] : [],
  )
}

test('the coverage rows grey out with the band hidden', () => {
  for (const row of menu(false)) {
    expect(row).toMatchObject({
      disabled: true,
      disabledHelpText: expect.stringContaining('Coverage'),
    })
  }
})

test('the coverage rows are live with the band shown', () => {
  expect(menu(true).map(row => 'label' in row && row.label)).toEqual([
    'Coverage axis...',
    ALLELES,
  ])
  for (const row of menu(true)) {
    expect(row).toMatchObject({ disabled: false })
  }
})

test('with the alleles hidden the group ticks Off', () => {
  expect(tickedLabels(menu(true, 0.05, false))).toEqual(['Off'])
})

test('Off hides the alleles, and a fraction shows them at that floor', () => {
  const items = menu(true, 0, true)
  const click = (label: string) => {
    const row = alleleRows(items).find(r => 'label' in r && r.label === label)
    if (!row || !('onClick' in row)) {
      throw new Error(`no "${label}" row`)
    }
    row.onClick({})
  }
  click('Off')
  expect(items.state.showCoverageAlleles).toBe(false)
  click('Above 10%')
  expect(items.state).toEqual({
    showCoverageAlleles: true,
    minAlleleFraction: 0.1,
  })
})

// The floor is a plain number a config can declare, so it need not be one of the
// five offered fractions. The group still has to say which one is nearest, or a
// track configured at 0.15 renders five unticked rows over a floor that is in
// effect. Ties go to the lower row.
test('an exact fraction ticks its own row', () => {
  expect(tickedLabels(menu(true, 0.05))).toEqual(['Above 5%'])
  expect(tickedLabels(menu(true, 0))).toEqual(['Every mismatch'])
})

test('a fraction between two options ticks the nearest, ties low', () => {
  expect(tickedLabels(menu(true, 0.15))).toEqual(['Above 10%'])
  expect(tickedLabels(menu(true, 0.17))).toEqual(['Above 20%'])
  expect(tickedLabels(menu(true, 0.5))).toEqual(['Above 20%'])
  expect(tickedLabels(menu(true, 0.002))).toEqual(['Every mismatch'])
})
