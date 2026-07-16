import { getSashimiMenuItem } from './sashimi.ts'
import { DEFAULT_MIN_SASHIMI_SCORE } from '../constants.ts'

import type { SashimiArcsMode } from '../constants.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// stateful stand-in for a DisplayTypeDefaultControl (the menu builder only touches
// active/toggle)
function control(): DisplayTypeDefaultControl {
  return {
    active: false,
    toggle() {
      this.active = !this.active
    },
  }
}

function makeModel() {
  return {
    showSashimiArcs: false,
    setShowSashimiArcs(v: boolean) {
      this.showSashimiArcs = v
    },
    showSashimiLabels: false,
    setShowSashimiLabels() {},
    showSashimiLabelsDisplayTypeDefault: control(),
    sashimiArcsMode: 'auto' as SashimiArcsMode,
    setSashimiArcsMode(mode: SashimiArcsMode) {
      this.sashimiArcsMode = mode
    },
    sashimiDownDisplayTypeDefault: control(),
    sashimiAutoDisplayTypeDefault: control(),
    minSashimiScore: DEFAULT_MIN_SASHIMI_SCORE,
    setMinSashimiScore() {},
  }
}

function endAdornmentOf(item: MenuItem | undefined) {
  return item && 'endAdornment' in item ? item.endAdornment : undefined
}

function labels(model: ReturnType<typeof makeModel>) {
  return getSashimiMenuItem(model).subMenu.flatMap(i =>
    'label' in i ? [i.label] : [],
  )
}

describe('sashimi menu', () => {
  test('only the toggle shows until sashimi arcs are on', () => {
    const model = makeModel()
    expect(labels(model)).toEqual(['Show sashimi arcs'])
  })

  test('labels, placement, and score filter appear when arcs are on', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    expect(labels(model)).toEqual([
      'Show sashimi arcs',
      'Show labels',
      'Arc placement',
      'Filter by score',
    ])
  })

  test('placement submenu checks the active mode and switches on click', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const placement = getSashimiMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Arc placement',
    )
    if (!placement || !('subMenu' in placement)) {
      throw new Error('no placement submenu')
    }
    const below = placement.subMenu.find(
      i => 'label' in i && i.label === 'Below coverage',
    )
    if (!below || !('onClick' in below)) {
      throw new Error('no below-coverage item')
    }
    below.onClick()
    expect(model.sashimiArcsMode).toBe('down')
  })

  test('"Below coverage" and "Auto" carry a default-for-all pin, "Above coverage" does not', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const placement = getSashimiMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Arc placement',
    )
    if (!placement || !('subMenu' in placement)) {
      throw new Error('no placement submenu')
    }
    const byLabel = (label: string) =>
      placement.subMenu.find(i => 'label' in i && i.label === label)
    expect(endAdornmentOf(byLabel('Below coverage'))).toBeDefined()
    expect(endAdornmentOf(byLabel('Auto (minimize overlap)'))).toBeDefined()
    expect(endAdornmentOf(byLabel('Above coverage'))).toBeUndefined()
  })

  test('"Show labels" carries a default-for-all pin', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const showLabels = getSashimiMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Show labels',
    )
    expect(endAdornmentOf(showLabels)).toBeDefined()
  })
})
