import { getSashimiMenuItem } from './sashimi.ts'

import type { SashimiArcsMode } from '../constants.ts'

// stateful stand-in for a SessionDefaultControl bundle ({ active, toggle })
function control() {
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
    showSashimiLabelsSessionDefault: control(),
    sashimiArcsMode: 'auto' as SashimiArcsMode,
    setSashimiArcsMode(mode: SashimiArcsMode) {
      this.sashimiArcsMode = mode
    },
    sashimiDownSessionDefault: control(),
    sashimiAutoSessionDefault: control(),
    minSashimiScore: 0,
    setMinSashimiScore() {},
  }
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
      'Filter by score...',
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
    expect(byLabel('Below coverage')?.endAdornment).toBeDefined()
    expect(byLabel('Auto (minimize overlap)')?.endAdornment).toBeDefined()
    expect(byLabel('Above coverage')?.endAdornment).toBeUndefined()
  })

  test('"Show labels" carries a default-for-all pin', () => {
    const model = makeModel()
    model.showSashimiArcs = true
    const showLabels = getSashimiMenuItem(model).subMenu.find(
      i => 'label' in i && i.label === 'Show labels',
    )
    expect(showLabels?.endAdornment).toBeDefined()
  })
})
