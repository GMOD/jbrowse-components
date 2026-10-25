import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { DEFAULT_MIN_SASHIMI_READS } from '../../shared/alignmentsFilter.ts'
import {
  getJunctionFilterItems,
  getSashimiPlacementItems,
  sashimiShowItems,
} from './sashimi.ts'

import type { JunctionFilter, JunctionFilterPatch } from '../../shared/types.ts'
import type { SashimiPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

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

function labelsOf(items: MenuItem[]) {
  return items.flatMap(i => ('label' in i ? [i.label] : []))
}

function subMenuByLabel(items: MenuItem[], prefix: string) {
  const item = items.find(
    i => 'label' in i && String(i.label).startsWith(prefix),
  )
  if (!item || !('subMenu' in item)) {
    throw new Error(`no ${prefix} submenu`)
  }
  return resolveSubMenu(item)
}

function click(items: MenuItem[], label: string) {
  const row = items.find(i => 'label' in i && i.label === label)
  if (!row || !('onClick' in row)) {
    throw new Error(`no ${label} row`)
  }
  row.onClick()
}

describe('sashimi rows in Show...', () => {
  test('Show... holds the arcs toggle alone', () => {
    const model = makeModel()
    expect(labelsOf(sashimiShowItems(model))).toEqual(['Sashimi arcs'])
    model.showSashimi = true
    expect(labelsOf(sashimiShowItems(model))).toEqual(['Sashimi arcs'])
  })
})

describe('junction filter rows', () => {
  test('appear only while the arcs draw', () => {
    const model = makeModel()
    expect(getJunctionFilterItems(model)).toEqual([])
    model.showSashimi = true
    expect(labelsOf(getJunctionFilterItems(model))).toEqual([
      'Junctions from split reads',
      'Non-canonical junctions',
      'Min reads at a junction',
    ])
  })

  test('"Junctions from split reads" writes junction.source', () => {
    const model = makeModel()
    model.showSashimi = true
    const writes: JunctionFilterPatch[] = []
    const setJunctionFilter = model.setJunctionFilter.bind(model)
    model.setJunctionFilter = patch => {
      writes.push(patch)
      setJunctionFilter({ ...patch, classes: patch.classes ?? ['splice'] })
    }
    const label = 'Junctions from split reads'
    const checked = () =>
      getJunctionFilterItems(model).find(i => 'label' in i && i.label === label)
    expect(checked()).toMatchObject({ checked: true })
    click(getJunctionFilterItems(model), label)
    expect(writes.at(-1)).toEqual({ sources: ['gap'] })
    expect(checked()).toMatchObject({ checked: false })
    click(getJunctionFilterItems(model), label)
    expect(writes.at(-1)).toEqual({
      classes: ['splice', 'deletion', 'duplication', 'inversion'],
    })
  })

  test('"Non-canonical junctions" is one All / Only / Hide choice', () => {
    const model = makeModel()
    model.showSashimi = true
    const choose = (label: string) => {
      click(
        subMenuByLabel(getJunctionFilterItems(model), 'Non-canonical'),
        label,
      )
    }
    choose('Hide non-canonical junctions')
    expect(model.junctionFilter.nonCanonical).toBe('exclude')
    expect(labelsOf(getJunctionFilterItems(model))).toContain(
      'Non-canonical junctions — hidden',
    )
    choose('Only non-canonical junctions')
    expect(model.junctionFilter.nonCanonical).toBe('only')
    choose('All junctions')
    expect(model.junctionFilter.nonCanonical).toBeUndefined()
  })

  test('the read-support floor is a submenu holding its slider', () => {
    const model = makeModel()
    model.showSashimi = true
    const floor = subMenuByLabel(getJunctionFilterItems(model), 'Min reads')
    expect(floor.map(i => 'type' in i && i.type)).toEqual(['custom'])
  })
})

describe('sashimi rows in Advanced', () => {
  test('the counts show while the arcs draw, placement only over the coverage band', () => {
    const model = makeModel()
    expect(getSashimiPlacementItems(model)).toEqual([])
    model.showSashimi = true
    model.showCoverage = false
    expect(labelsOf(getSashimiPlacementItems(model))).toEqual([
      'Sashimi read counts',
    ])
    model.showCoverage = true
    expect(labelsOf(getSashimiPlacementItems(model))).toEqual([
      'Sashimi read counts',
      'Sashimi placement',
    ])
  })

  test('switches the mode on click', () => {
    const model = makeModel()
    model.showSashimi = true
    click(
      subMenuByLabel(getSashimiPlacementItems(model), 'Sashimi placement'),
      'Below coverage',
    )
    expect(model.sashimiPlacement).toBe('down')
  })
})
