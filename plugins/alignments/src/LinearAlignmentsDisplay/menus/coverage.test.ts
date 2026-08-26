import { getCoverageMenuItem } from './coverage.ts'

// Every setting in this submenu scales the coverage band's draw and its hit
// test and reaches nothing else, and — unlike the sashimi and read-connection
// menus — it carries no visibility toggle of its own, so with the band hidden
// it is a submenu of controls with no way back. It greys out and names the
// switch instead.
function menu(showCoverage: boolean) {
  return getCoverageMenuItem({
    numStdDev: 3,
    showCoverage,
    coverageSnpMinFrequency: 0,
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
  const rows = 'subMenu' in item ? item.subMenu : []
  for (const row of rows) {
    expect(row).not.toHaveProperty('pin')
  }
})
