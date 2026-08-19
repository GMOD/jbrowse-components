import { DEFAULT_MIN_SASHIMI_SCORE } from '../constants.ts'
import { getSashimiMenuItem } from './sashimi.ts'

import type { SashimiArcsMode } from '../constants.ts'
import type { Pin } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// stateful stand-in for a Pin (the menu builder only touches
// active/toggle; `slot` is what a built menu is later asked for by
// promotableSlotsWithoutPin, and `onValue` what PinAdornment words itself
// from — neither is read here)
function control(slot: string, onValue: unknown = false): Pin {
  return {
    slot,
    onValue,
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
    showSashimiArcsDisplayTypeDefault: control('showSashimiArcs'),
    showSashimiLabels: false,
    setShowSashimiLabels() {},
    showSashimiLabelsDisplayTypeDefault: control('showSashimiLabels'),
    sashimiArcsMode: 'auto' as SashimiArcsMode,
    setSashimiArcsMode(mode: SashimiArcsMode) {
      this.sashimiArcsMode = mode
    },
    sashimiArcsModeDisplayTypeDefault: (mode: SashimiArcsMode) =>
      control('sashimiArcsMode', mode),
    minSashimiScore: DEFAULT_MIN_SASHIMI_SCORE,
    setMinSashimiScore() {},
  }
}

// the "default for all tracks of this type" pin, carried as a description
// (`pin`) rather than a rendered element — see ui/MenuTypes.ts
function defaultForAllOf(item: MenuItem | undefined) {
  return item && 'pin' in item ? item.pin : undefined
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

  test('every arc-placement option carries a default-for-all pin', () => {
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
    expect(defaultForAllOf(byLabel('Below coverage'))).toBeDefined()
    expect(defaultForAllOf(byLabel('Auto (minimize overlap)'))).toBeDefined()
    expect(defaultForAllOf(byLabel('Above coverage'))).toBeDefined()
  })

  test('"Show labels" carries a default-for-all pin', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const showLabels = getSashimiMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Show labels',
    )
    expect(defaultForAllOf(showLabels)).toBeDefined()
  })

  test('"Show sashimi arcs" carries one too', () => {
    // It gates everything below it and was the one control in its own submenu
    // with no pin, so "show sashimi arcs by default for every track" was the
    // single thing this menu couldn't express.
    const model = makeModel()
    const toggle = getSashimiMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Show sashimi arcs',
    )
    expect(defaultForAllOf(toggle)).toBeDefined()
  })
})
