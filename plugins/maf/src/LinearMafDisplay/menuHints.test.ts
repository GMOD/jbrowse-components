import { createMafTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The two band toggles are the only settings the summary tier overrides, and it
// overrides them silently: `coverageBandActive` / `conservationBandActive` zero
// the bands while the ticks keep reporting what the user chose (deliberately —
// zooming back in has to restore them without a second click). Ticking either
// one out here therefore does nothing observable at all, so the row says why.
// Annotated because it recurses into its own return type (TS7023 otherwise).
function findRow(
  items: MenuItem[],
  label: string,
): (MenuItem & { subLabel?: string }) | undefined {
  for (const item of items) {
    if ('label' in item && item.label === label) {
      return item
    }
    if ('subMenu' in item) {
      const hit = findRow(item.subMenu, label)
      if (hit) {
        return hit
      }
    }
  }
  return undefined
}

const BAND_ROWS = ['Show coverage', 'Show conservation (% identity)']
const HINT = 'zoom in past the summary tier to see it'

describe('the band toggles say when the summary tier has overridden them', () => {
  it('adds the hint past the floor', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    view.zoomTo(100)
    expect(display.showSummary).toBe(true)

    const items = display.trackMenuItems()
    for (const label of BAND_ROWS) {
      expect(findRow(items, label)?.subLabel).toBe(HINT)
    }
  })

  it('drops it below the floor, where the ticks do what they say', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    view.zoomTo(1)
    expect(display.showSummary).toBe(false)

    const items = display.trackMenuItems()
    for (const label of BAND_ROWS) {
      expect(findRow(items, label)?.subLabel).toBeUndefined()
    }
  })

  // A track with no summary file never enters the tier, so it never earns the
  // hint however far out it is zoomed — it gets the force-load prompt instead.
  it('never adds it to a track with no summary file', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(400)
    const items = display.trackMenuItems()
    for (const label of BAND_ROWS) {
      expect(findRow(items, label)?.subLabel).toBeUndefined()
    }
  })
})
