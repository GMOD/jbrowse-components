import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { DEFAULT_MIN_SASHIMI_READS } from '../../shared/alignmentsFilter.ts'
import { getSashimiMenuItem } from './sashimi.ts'

import type { JunctionFilter } from '../../shared/types.ts'
import type { SashimiPlacement } from '../constants.ts'

function makeModel() {
  return {
    showCoverage: true,
    showSashimi: false,
    setShowSashimi(v: boolean) {
      this.showSashimi = v
    },
    showSashimiCounts: false,
    setShowSashimiCounts() {},
    sashimiPlacement: 'auto' as SashimiPlacement,
    setSashimiPlacement(mode: SashimiPlacement) {
      this.sashimiPlacement = mode
    },
    junctionFilter: { minReads: DEFAULT_MIN_SASHIMI_READS } as JunctionFilter,
    setJunctionFilter(patch: Partial<JunctionFilter>) {
      this.junctionFilter = { ...this.junctionFilter, ...patch }
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

  test('with coverage off the arcs still toggle, and placement greys out naming the switch', () => {
    const model = makeModel()
    model.showCoverage = false
    model.showSashimi = true
    const [toggle, , placement] = resolveSubMenu(getSashimiMenuItem(model))
    expect(toggle).not.toHaveProperty('disabled')
    expect(placement).toMatchObject({
      label: 'Arc placement',
      disabled: true,
      disabledHelpText: expect.stringContaining('Show... → Coverage'),
    })
  })

  test('counts, placement, and the two filters appear when arcs are on', () => {
    const model = makeModel()
    model.showSashimi = true
    expect(labels(model)).toEqual([
      'Show sashimi arcs',
      'Show read counts',
      'Arc placement',
      'Non-canonical junctions',
      'Min read support',
    ])
  })

  // Arity orders the rows, so the row shape changes once down the menu rather
  // than flickering — the rule the synteny and dotplot settings menus follow.
  // Pinned as a shape run rather than by the label order above, which a sixth
  // setting dropped in beside its subject would satisfy while breaking this.
  test('every checkbox precedes every submenu', () => {
    const model = makeModel()
    model.showSashimi = true
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
    model.showSashimi = true
    const withHelp = resolveSubMenu(getSashimiMenuItem(model)).filter(
      i => 'helpText' in i && i.helpText,
    )
    expect(withHelp).toEqual([])
  })

  test('the read-support floor is a submenu holding its slider', () => {
    const model = makeModel()
    model.showSashimi = true
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

  test('"Non-canonical junctions" is one All / Only / Hide choice', () => {
    const model = makeModel()
    model.showSashimi = true
    const choose = (label: string) => {
      const group = resolveSubMenu(getSashimiMenuItem(model)).find(
        i =>
          'label' in i && String(i.label).startsWith('Non-canonical junctions'),
      )
      if (!group || !('subMenu' in group)) {
        throw new Error('no non-canonical submenu')
      }
      const row = resolveSubMenu(group).find(
        i => 'label' in i && i.label === label,
      )
      if (!row || !('onClick' in row)) {
        throw new Error(`no ${label} row`)
      }
      row.onClick()
    }
    choose('Hide non-canonical junctions')
    expect(model.junctionFilter.nonCanonical).toBe('exclude')
    expect(labels(model)).toContain('Non-canonical junctions — hidden')
    choose('Only non-canonical junctions')
    expect(model.junctionFilter.nonCanonical).toBe('only')
    choose('All junctions')
    expect(model.junctionFilter.nonCanonical).toBeUndefined()
  })

  test('placement submenu checks the active mode and switches on click', () => {
    const model = makeModel()
    model.showSashimi = true
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
    expect(model.sashimiPlacement).toBe('down')
  })
})
