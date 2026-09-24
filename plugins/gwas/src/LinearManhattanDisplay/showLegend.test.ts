import { getConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The color key — the r² ramp under LD coloring, the value table under field
// coloring — is a config slot through LegendMixin. It was a VOLATILE once,
// sitting with `hoveredFeature` and `rpcDataMap`, so it reset on every retick
// and turning the key off lasted only until the track was hidden and reshown.
// These pin that it persists.
//
// The `ld` scale throughout, since the row is disabled (though still present,
// and still pinned) under the plain single-color scheme.

function legendRow(items: MenuItem[]) {
  const walk = (list: MenuItem[]): MenuItem[] =>
    list.flatMap(i => ('subMenu' in i ? walk(resolveSubMenu(i)) : [i]))
  return walk(items).find(i => 'label' in i && i.label === 'Show legend')
}

describe('Manhattan showLegend', () => {
  it('is on by default, from the schema rather than a volatile initializer', () => {
    const { display } = createTestEnvironment({
      color: { field: 'ld' },
    }).createDisplay()
    expect(display.showLegend).toBe(true)
  })

  // The whole point of the volatile -> config move. A volatile write was lost
  // on the next retick; a config write lands on the display's config node,
  // which outlives the display instance.
  it('an explicit off is written to the config node, so it survives a retick', () => {
    const { display } = createTestEnvironment({
      color: { field: 'ld' },
    }).createDisplay()
    display.setShowLegend(false)

    expect(display.showLegend).toBe(false)
    expect(getConf(display, 'showLegend')).toBe(false)
  })

  it('leaves the row out under the plain color scheme, which has no key', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(legendRow(display.trackMenuItems())).toBeUndefined()
  })

  it('offers the row under a threshold scale over any field, which draws a key', () => {
    const { display } = createTestEnvironment({
      color: { field: 'p', scale: 'threshold', domain: ['0.1'] },
    }).createDisplay()
    expect(display.colorScales).toHaveLength(1)
    expect(legendRow(display.trackMenuItems())).toBeDefined()
  })
})
