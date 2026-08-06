import { setConf } from '@jbrowse/core/configuration'

import { createTestEnvironment } from './testEnv.ts'

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

    display.colorLegend!.dismiss()

    expect(display.colorLegend).toBeUndefined()
    expect(display.colorLegendDismissed).toBe(true)
  })
})
