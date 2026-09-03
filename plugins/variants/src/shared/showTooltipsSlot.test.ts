import { getConf } from '@jbrowse/core/configuration'
import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { createTestEnvironment as createMatrixTestEnvironment } from '../LinearMultiSampleVariantMatrixDisplay/testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// `showTooltips` was a display prop before the multi-sample rewrite, came back
// as a config slot, and is the only hover affordance the checkbox reaches: the
// crosshairs, the hovered-cell highlight and the cross-display `hoveredFeature`
// channel all read `hoveredFeature`, which stays written either way.

const HOVER = { genotype: '0|1', name: 'HG002' }

function showSubmenu(items: MenuItem[]) {
  const show = items.find(i => 'label' in i && i.label === 'Show...')
  if (!show || !('subMenu' in show)) {
    throw new Error('no "Show..." submenu in the track menu')
  }
  return resolveSubMenu(show)
}

function tooltipItem(items: MenuItem[]) {
  const item = showSubmenu(items).find(
    i => 'label' in i && i.label === 'Show tooltips',
  )
  if (!item || !('type' in item) || item.type !== 'checkbox') {
    throw new Error('no "Show tooltips" checkbox in the "Show..." submenu')
  }
  return item
}

function regularDisplay() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources([{ name: 'HG002', population: 'EUR' }])
  return display
}

describe('showTooltips', () => {
  it('defaults on, off the resolved slot rather than a missing one', () => {
    const display = regularDisplay()
    // both halves: an unbuilt harness config reads every slot as undefined, so
    // the getter agreeing with `getConf` is what says the slot is resolving
    expect(getConf(display, 'showTooltips')).toBe(true)
    expect(display.showTooltips).toBe(true)
  })

  it('suppresses the tooltip and nothing else beside it', () => {
    const display = regularDisplay()
    display.setHoveredFeature(HOVER)
    expect(display.hoveredTooltipSource).toMatchObject({ genotype: '0|1' })

    display.setShowTooltips(false)
    expect(display.hoveredTooltipSource).toBeUndefined()
    // the hit test still ran and the session-wide hover channel still sees it
    expect(display.hoveredFeature).toEqual(HOVER)
    expect(display.hoveredFeature).toEqual(HOVER)
  })

  it('writes the config slot, so it survives into the session', () => {
    const display = regularDisplay()
    display.setShowTooltips(false)
    expect(getConf(display, 'showTooltips')).toBe(false)
    expect(getSnapshot(display.configuration)).toMatchObject({
      showTooltips: false,
    })
  })

  it('offers the checkbox in the "Show..." submenu of both displays', () => {
    const { display: matrix } = createMatrixTestEnvironment().createDisplay()
    for (const display of [regularDisplay(), matrix]) {
      const item = tooltipItem(display.trackMenuItems())
      expect(item.checked).toBe(true)
      // a setting, not an action: flipping it must not dismiss the menu
      expect(staysOpenOnClick(item)).toBe(true)
      item.onClick()
      expect(display.showTooltips).toBe(false)
      expect(tooltipItem(display.trackMenuItems()).checked).toBe(false)
    }
  })
})
