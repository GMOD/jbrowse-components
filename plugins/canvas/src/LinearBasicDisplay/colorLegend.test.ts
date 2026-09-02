import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The declared color key. A `jexl:` color expression paints a category the
// drawn feature carries no name for, so the vocabulary is a config slot; the
// shared canvas body (and the SVG export, off the same hook) draws whatever
// `colorLegend` returns.

describe('declared color legend', () => {
  it('is empty until the legend slot carries entries', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.colorLegend).toEqual([])

    setConf(display, 'legend', [
      { label: 'SINE', color: '#e41a1c' },
      { label: 'LINE', color: '#377eb8' },
    ])
    expect(display.colorLegend).toEqual([
      { label: 'SINE', color: '#e41a1c' },
      { label: 'LINE', color: '#377eb8' },
    ])
  })

  // The key's own "×" writes the same showLegend slot the track menu's
  // checkbox toggles, so putting it away and getting it back are one setting.
  it('offers the showLegend toggle only where there is a key', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    const showItems = () => {
      const show = display
        .trackMenuItems()
        .find((i: MenuItem) => 'label' in i && i.label === 'Show...')
      return show && 'subMenu' in show ? resolveSubMenu(show) : []
    }
    const legendItem = () =>
      showItems().find(
        (i: MenuItem) => 'label' in i && i.label === 'Show legend',
      )

    expect(legendItem()).toBeUndefined()

    setConf(display, 'legend', [{ label: 'SINE', color: '#e41a1c' }])
    expect(display.showLegend).toBe(true)
    expect(legendItem()).toMatchObject({ type: 'checkbox', checked: true })

    display.setShowLegend(false)
    const hidden = legendItem()!
    expect(hidden).toMatchObject({ type: 'checkbox', checked: false })

    if ('onClick' in hidden) {
      hidden.onClick()
    }
    expect(display.showLegend).toBe(true)
  })
})
