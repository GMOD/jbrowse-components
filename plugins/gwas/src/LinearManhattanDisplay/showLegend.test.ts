import { getConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The color key — the r² ramp under LD coloring, the value table under field
// coloring — is a promotable config slot through LegendMixin. It was a VOLATILE
// once, sitting with `hoveredFeature` and `rpcDataMap`, so it reset on every
// retick and turning the key off lasted only until the track was hidden and
// reshown. These pin the two halves of the change: it persists, and it
// cascades.
//
// `colorBy: 'ld'` throughout, since the row is disabled (though still present,
// and still pinned) under the plain single-color scheme.

function legendRow(items: MenuItem[]) {
  const walk = (list: MenuItem[]): MenuItem[] =>
    list.flatMap(i => ('subMenu' in i ? walk(resolveSubMenu(i)) : [i]))
  return walk(items).find(i => 'label' in i && i.label === 'Show legend')
}

describe('Manhattan showLegend', () => {
  it('is on by default, from the schema rather than a volatile initializer', () => {
    const { display } = createTestEnvironment({ colorBy: 'ld' }).createDisplay()
    expect(display.showLegend).toBe(true)
  })

  // The whole point of the volatile -> config move. A volatile write was lost
  // on the next retick; a config write lands on the display's config node,
  // which outlives the display instance.
  it('an explicit off is written to the config node, so it survives a retick', () => {
    const { display } = createTestEnvironment({ colorBy: 'ld' }).createDisplay()
    display.setShowLegend(false)

    expect(display.showLegend).toBe(false)
    expect(getConf(display, 'showLegend')).toBe(false)
  })

  // The row is greyed out without LD coloring, but it is still built.
  it('still offers the row under the plain color scheme, disabled', () => {
    const { display } = createTestEnvironment().createDisplay()
    const row = legendRow(display.trackMenuItems())
    expect(row && 'disabled' in row ? row.disabled : undefined).toBe(true)
  })
})
