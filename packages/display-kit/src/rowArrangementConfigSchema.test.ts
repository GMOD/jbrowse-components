import {
  ConfigurationSchema,
  applyConfSettings,
  getConfigurationSchemaMetadata,
  plotOf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'

import {
  ROW_ARRANGEMENT_MEMBERS,
  rowArrangementConfigSchema,
} from './rowArrangementConfigSchema.ts'
import { rowsConfigSchema } from './rowsConfigSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// "Reset row order" and the arrangement writers walk the list, so a slot
// missing from it survives a reset.
test('the arrangement members are every RowArrangement slot', () => {
  const slots = Object.keys(
    getConfigurationSchemaMetadata(rowArrangementConfigSchema)!.definition,
  )
  expect([...ROW_ARRANGEMENT_MEMBERS].sort()).toEqual(slots.sort())
})

const Display = ConfigurationSchema(
  'TreeHost',
  { rows: rowsConfigSchema },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

const NEWICK = '((a,b),c);'
const PROVENANCE = { regions: [{ refName: 'chr1', start: 0, end: 100 }] }

function treeOf(conf: Instance<typeof Display>) {
  return {
    newick: readConfObject(conf, ['rows', 'tree', 'newick']),
    provenance: readConfObject(conf, ['rows', 'tree', 'provenance']),
  }
}

test('a newick string loads as the tree with no provenance', () => {
  const conf = Display.create({ displayId: 's', rows: { tree: NEWICK } })
  expect(treeOf(conf)).toEqual({ newick: NEWICK, provenance: undefined })
})

test('the object form loads with its provenance', () => {
  const conf = Display.create({
    displayId: 'o',
    rows: { tree: { newick: NEWICK, provenance: PROVENANCE } },
  })
  expect(treeOf(conf)).toEqual({ newick: NEWICK, provenance: PROVENANCE })
})

test('a plot read gives the object form whichever form was written', () => {
  const written = Display.create({
    displayId: 'p',
    rows: { field: 'source', tree: NEWICK },
  })
  expect(plotOf(written).rows).toEqual({
    field: 'source',
    tree: { newick: NEWICK },
  })
})

test('a field change clears the tree with its provenance', () => {
  const bag = Display.create({
    displayId: 'b',
    rows: {
      field: 'source',
      tree: { newick: NEWICK, provenance: PROVENANCE },
    },
  })
  applyConfSettings(bag, { rows: 'tissue' })
  expect(treeOf(bag)).toEqual({ newick: undefined, provenance: undefined })

  const member = Display.create({
    displayId: 'm',
    rows: {
      field: 'source',
      tree: { newick: NEWICK, provenance: PROVENANCE },
    },
  })
  setConf(member, ['rows', 'field'], 'tissue')
  expect(treeOf(member)).toEqual({ newick: undefined, provenance: undefined })
})

test('a tree written as newick alone drops the provenance it replaces', () => {
  const conf = Display.create({
    displayId: 'w',
    rows: { tree: { newick: NEWICK, provenance: PROVENANCE } },
  })
  applyConfSettings(conf, { rows: { tree: '(c,(a,b));' } })
  expect(treeOf(conf)).toEqual({ newick: '(c,(a,b));', provenance: undefined })
})

test('a treeProvenance written beside rows.tree points at rows.tree', () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  Display.create({
    displayId: 'old',
    rows: { tree: NEWICK, treeProvenance: PROVENANCE },
  })
  expect(spy.mock.calls.map(([message]) => message)).toEqual([
    'Rows does not declare treeProvenance: loading without it — did you mean tree.provenance?',
  ])
  spy.mockRestore()
})
