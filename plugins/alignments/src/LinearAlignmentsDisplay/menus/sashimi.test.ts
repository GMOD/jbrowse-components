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
    hideNonCanonicalJunctions: false,
    setHideNonCanonicalJunctions(v: boolean) {
      this.hideNonCanonicalJunctions = v
    },
    hideNonCanonicalJunctionsDisplayTypeDefault: control(
      'hideNonCanonicalJunctions',
    ),
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

  test('labels, placement, and the two filters appear when arcs are on', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    expect(labels(model)).toEqual([
      'Show sashimi arcs',
      'Show labels',
      'Hide non-canonical junctions',
      'Arc placement',
      'Min read support',
    ])
  })

  // Arity orders the rows, so the row shape changes once down the menu rather
  // than flickering — the rule the synteny and dotplot settings menus follow.
  // Pinned as a shape run rather than by the label order above, which a sixth
  // setting dropped in beside its subject would satisfy while breaking this.
  test('every checkbox precedes every submenu', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const shapes = getSashimiMenuItem(model).subMenu.map(i =>
      'subMenu' in i ? 'submenu' : 'checkbox',
    )
    expect(shapes.lastIndexOf('checkbox')).toBeLessThan(
      shapes.indexOf('submenu'),
    )
    expect(new Set(shapes)).toEqual(new Set(['checkbox', 'submenu']))
  })

  test('the read-support floor is a submenu holding its slider', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const floor = getSashimiMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Min read support',
    )
    if (!floor || !('subMenu' in floor)) {
      throw new Error('no read-support submenu')
    }
    // the size row itself, which draws its own slider rather than reaching the
    // menu's shared trailing column (ui/makeSizeMenu.tsx)
    expect(floor.subMenu.map(i => 'type' in i && i.type)).toEqual(['custom'])
  })

  test('"Hide non-canonical junctions" toggles and carries a pin', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const row = getSashimiMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Hide non-canonical junctions',
    )
    if (!row || !('onClick' in row)) {
      throw new Error('no non-canonical row')
    }
    row.onClick()
    expect(model.hideNonCanonicalJunctions).toBe(true)
    expect(defaultForAllOf(row)).toBeDefined()
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
