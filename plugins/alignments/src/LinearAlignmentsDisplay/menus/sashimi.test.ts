import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { DEFAULT_MIN_SASHIMI_SCORE } from '../constants.ts'
import { getSashimiMenuItem } from './sashimi.ts'

import type { SashimiArcsMode } from '../constants.ts'

function makeModel() {
  return {
    showSashimiArcs: false,
    setShowSashimiArcs(v: boolean) {
      this.showSashimiArcs = v
    },
    showSashimiLabels: false,
    setShowSashimiLabels() {},
    sashimiArcsMode: 'auto' as SashimiArcsMode,
    setSashimiArcsMode(mode: SashimiArcsMode) {
      this.sashimiArcsMode = mode
    },
    minSashimiScore: DEFAULT_MIN_SASHIMI_SCORE,
    setMinSashimiScore() {},
    hideNonCanonicalJunctions: false,
    setHideNonCanonicalJunctions(v: boolean) {
      this.hideNonCanonicalJunctions = v
    },
  }
}

function labels(model: ReturnType<typeof makeModel>) {
  return resolveSubMenu(getSashimiMenuItem(model)).flatMap(i =>
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
    const shapes = resolveSubMenu(getSashimiMenuItem(model)).map(i =>
      'subMenu' in i ? 'submenu' : 'checkbox',
    )
    expect(shapes.lastIndexOf('checkbox')).toBeLessThan(
      shapes.indexOf('submenu'),
    )
    expect(new Set(shapes)).toEqual(new Set(['checkbox', 'submenu']))
  })

  // Every label here says what its setting does, and the splice motifs behind
  // "non-canonical" are in the user guide, the arc's tooltip and its detail
  // panel — the last two naming the motif that junction actually has.
  test('no row carries a "?"', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const withHelp = resolveSubMenu(getSashimiMenuItem(model)).filter(
      i => 'helpText' in i && i.helpText,
    )
    expect(withHelp).toEqual([])
  })

  test('the read-support floor is a submenu holding its slider', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const floor = resolveSubMenu(getSashimiMenuItem(model)).find(
      i => 'label' in i && i.label === 'Min read support',
    )
    if (!floor || !('subMenu' in floor)) {
      throw new Error('no read-support submenu')
    }
    // the size row itself, which draws its own slider rather than reaching the
    // menu's shared trailing column (ui/makeSizeMenu.tsx)
    expect(resolveSubMenu(floor).map(i => 'type' in i && i.type)).toEqual([
      'custom',
    ])
  })

  test('"Hide non-canonical junctions" toggles', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const row = resolveSubMenu(getSashimiMenuItem(model)).find(
      i => 'label' in i && i.label === 'Hide non-canonical junctions',
    )
    if (!row || !('onClick' in row)) {
      throw new Error('no non-canonical row')
    }
    row.onClick()
    expect(model.hideNonCanonicalJunctions).toBe(true)
  })

  test('placement submenu checks the active mode and switches on click', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const placement = resolveSubMenu(getSashimiMenuItem(model)).find(
      i => 'label' in i && i.label === 'Arc placement',
    )
    if (!placement || !('subMenu' in placement)) {
      throw new Error('no placement submenu')
    }
    const below = resolveSubMenu(placement).find(
      i => 'label' in i && i.label === 'Below coverage',
    )
    if (!below || !('onClick' in below)) {
      throw new Error('no below-coverage item')
    }
    below.onClick()
    expect(model.sashimiArcsMode).toBe('down')
  })
})
