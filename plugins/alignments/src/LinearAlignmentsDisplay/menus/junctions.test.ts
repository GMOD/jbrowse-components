import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import {
  junctionEntries,
  junctionFilterOf,
  withFields,
} from '../../shared/alignmentsFilter.ts'
import {
  getJunctionFilterItems,
  getJunctionsPlacementItems,
  junctionsShowItems,
} from './junctions.ts'

import type { JunctionFilter, JunctionFilterPatch } from '../../shared/types.ts'
import type { JunctionsPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

function makeModel() {
  return {
    showJunctions: false,
    setShowJunctions(v: boolean) {
      this.showJunctions = v
    },
    showJunctionLabels: false,
    setShowJunctionLabels() {},
    junctionsPlacement: 'auto' as JunctionsPlacement,
    setJunctionsPlacement(mode: JunctionsPlacement) {
      this.junctionsPlacement = mode
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

describe('junctions rows in Show', () => {
  test('the counts appear only while the arcs draw', () => {
    const model = makeModel()
    expect(labelsOf(junctionsShowItems(model))).toEqual(['Show junctions'])
    model.showJunctions = true
    expect(labelsOf(junctionsShowItems(model))).toEqual([
      'Show junctions',
      'Show junction read counts',
    ])
  })
})

describe('junctions placement row', () => {
  test('appears while the arcs draw', () => {
    const model = makeModel()
    expect(getJunctionsPlacementItems(model)).toEqual([])
    model.showJunctions = true
    expect(labelsOf(getJunctionsPlacementItems(model))).toEqual([
      'Junction placement',
    ])
  })

  // The model the row reads has no coverage member, so a strip above coverage
  // can be left from the menu with the band hidden.
  test('leaves the strip above coverage on click', () => {
    const model = { ...makeModel(), showJunctions: true }
    model.junctionsPlacement = 'above'
    click(
      subMenuByLabel(getJunctionsPlacementItems(model), 'Junction placement'),
      'Over coverage',
    )
    expect(model.junctionsPlacement).toBe('overlay')
  })

  test('switches the mode on click', () => {
    const model = makeModel()
    model.showJunctions = true
    click(
      subMenuByLabel(getJunctionsPlacementItems(model), 'Junction placement'),
      'Below coverage',
    )
    expect(model.junctionsPlacement).toBe('below')
  })

  test('names the overlay and the strip above coverage apart', () => {
    const model = makeModel()
    model.showJunctions = true
    const rows = subMenuByLabel(
      getJunctionsPlacementItems(model),
      'Junction placement',
    )
    expect(labelsOf(rows)).toEqual([
      'Auto (minimize overlap)',
      'Over coverage',
      'Above coverage',
      'Below coverage',
    ])
    click(rows, 'Above coverage')
    expect(model.junctionsPlacement).toBe('above')
  })
})

describe('junction filter row', () => {
  test('carries its help text on the category row', () => {
    const model = { ...makeModel(), showJunctions: true, setFilterFields() {} }
    const [row] = getJunctionFilterItems(model)
    expect(row && 'helpText' in row ? row.helpText : undefined).toMatch(/GT-AG/)
  })
})
