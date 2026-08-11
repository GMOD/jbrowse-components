import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The declared color key. A `jexl:` color expression paints a category the
// drawn feature carries no name for, so the vocabulary is a config slot; the
// shared canvas body (and the SVG export, off the same hook) draws whatever
// `colorLegend` returns.

describe('declared color legend', () => {
  it('is absent until the legend slot carries entries', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.colorLegend).toBeUndefined()

    setConf(display, 'legend', [
      { label: 'SINE', color: '#e41a1c' },
      { label: 'LINE', color: '#377eb8' },
    ])
    expect(display.colorLegend?.items).toEqual([
      { label: 'SINE', color: '#e41a1c' },
      { label: 'LINE', color: '#377eb8' },
    ])
  })

  // Dismissing is session-only (a volatile), like the isoform-collapse chip's:
  // the config still declares the key, the user has just put it away.
  it('dismisses for the session without clearing the slot', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    setConf(display, 'legend', [{ label: 'SINE', color: '#e41a1c' }])

    display.colorLegend!.setDismissed(true)

    // the hook stays — it is what the "Show legend" checkbox reads — and says it
    // is dismissed, which is what the overlay and the SVG export draw off
    expect(display.colorLegend?.dismissed).toBe(true)
    expect(display.colorLegendDismissed).toBe(true)
  })

  // The key's own "×" removes the surface it lives on, so without a menu item
  // the dismissal lasted the whole session with nothing anywhere naming it —
  // the same hole the multi-row painting's "Show legend" checkbox closed.
  it('offers a way back from the dismissal, and only where there is a key', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    const showItems = () => {
      const show = display
        .trackMenuItems()
        .find((i: MenuItem) => 'label' in i && i.label === 'Show...')
      return show && 'subMenu' in show ? show.subMenu : []
    }
    const legendItem = () =>
      showItems().find(
        (i: MenuItem) => 'label' in i && i.label === 'Show legend',
      )

    // a track declaring no key has nothing to toggle
    expect(legendItem()).toBeUndefined()

    setConf(display, 'legend', [{ label: 'SINE', color: '#e41a1c' }])
    expect(legendItem()).toMatchObject({ type: 'checkbox', checked: true })

    display.colorLegend!.setDismissed(true)
    const dismissed = legendItem()!
    expect(dismissed).toMatchObject({ type: 'checkbox', checked: false })

    if ('onClick' in dismissed) {
      dismissed.onClick()
    }
    expect(display.colorLegend?.dismissed).toBe(false)
  })
})
