import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import {
  junctionEntries,
  junctionFilterOf,
  withFields,
} from '../../shared/alignmentsFilter.ts'
import { getSashimiPlacementItems, sashimiShowItems } from './sashimi.ts'

import type { JunctionFilter, JunctionFilterPatch } from '../../shared/types.ts'
import type { SashimiPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

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
    // the display's own write and read of `filter`
    filter: [] as FieldPredicate[],
    get junctionFilter(): JunctionFilter {
      return junctionFilterOf(this.filter)
    },
    setJunctionFilter(patch: JunctionFilterPatch) {
      this.filter = withFields(this.filter, junctionEntries(patch))
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
  test('the counts appear only while the arcs draw', () => {
    const model = makeModel()
    expect(labelsOf(sashimiShowItems(model))).toEqual(['Sashimi arcs'])
    model.showSashimi = true
    expect(labelsOf(sashimiShowItems(model))).toEqual([
      'Sashimi arcs',
      'Sashimi read counts',
    ])
  })
})

describe('sashimi placement row', () => {
  test('appears only while the arcs draw over the coverage band', () => {
    const model = makeModel()
    expect(getSashimiPlacementItems(model)).toEqual([])
    model.showSashimi = true
    model.showCoverage = false
    expect(getSashimiPlacementItems(model)).toEqual([])
    model.showCoverage = true
    expect(labelsOf(getSashimiPlacementItems(model))).toEqual([
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
