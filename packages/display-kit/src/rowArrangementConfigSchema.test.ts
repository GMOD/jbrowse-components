import {
  ConfigurationSchema,
  applyConfSettings,
  getConfigurationSchemaMetadata,
  plotOf,
  plotWrites,
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

describe('a provenance describes only the newick beside it', () => {
  const clustered = () =>
    Display.create({
      displayId: 'c',
      rows: {
        field: 'source',
        sort: ['b', 'a'],
        tree: { newick: NEWICK, provenance: PROVENANCE },
      },
    })
  const OTHER = '(c,(a,b));'

  test('a newick member write drops it, and restating the newick keeps it', () => {
    const conf = clustered()
    setConf(conf, ['rows', 'tree', 'newick'], NEWICK)
    expect(treeOf(conf)).toEqual({ newick: NEWICK, provenance: PROVENANCE })
    setConf(conf, ['rows', 'tree', 'newick'], OTHER)
    expect(treeOf(conf)).toEqual({ newick: OTHER, provenance: undefined })
  })

  test('a bag writing another newick member drops it', () => {
    const conf = clustered()
    applyConfSettings(conf, { rows: { tree: { newick: OTHER } } })
    expect(treeOf(conf)).toEqual({ newick: OTHER, provenance: undefined })
  })

  test('a plot edit of the newick drops the provenance the read restates', () => {
    const conf = clustered()
    const { rows } = plotOf(conf) as { rows: Record<string, unknown> }
    const draft = {
      rows: { ...rows, tree: { ...(rows.tree as object), newick: OTHER } },
    }
    expect(plotWrites(conf, draft, { whole: true }).rows).toEqual({
      field: 'source',
      sort: ['b', 'a'],
      tree: { newick: OTHER },
    })
    expect(plotWrites(conf, { rows: { tree: OTHER } }).rows).toEqual({
      field: 'source',
      sort: ['b', 'a'],
      tree: { newick: OTHER },
    })
  })

  test('a whole plot edit changing the field drops a tree restated as newick', () => {
    const conf = Display.create({
      displayId: 'f',
      rows: { field: 'source', sort: ['b', 'a'], tree: NEWICK },
    })
    expect(
      plotWrites(
        conf,
        { rows: { field: 'tissue', sort: ['b', 'a'], tree: NEWICK } },
        { whole: true },
      ).rows,
    ).toEqual({ field: 'tissue' })
  })

  test('a whole plot edit changing the field drops the clustered tree retyped as its newick', () => {
    const conf = clustered()
    expect(
      plotWrites(
        conf,
        { rows: { field: 'tissue', sort: ['b', 'a'], tree: NEWICK } },
        { whole: true },
      ).rows,
    ).toEqual({ field: 'tissue' })
  })

  test.each([null, ''])(
    'emptying the newick as a member (%p), then writing one, leaves no provenance',
    empty => {
      const conf = clustered()
      setConf(conf, ['rows', 'tree', 'newick'], empty)
      expect(treeOf(conf).provenance).toBeUndefined()
      setConf(conf, ['rows', 'tree', 'newick'], OTHER)
      expect(treeOf(conf)).toEqual({ newick: OTHER, provenance: undefined })
    },
  )

  test('a bag emptying the newick, then writing one, leaves no provenance', () => {
    const conf = clustered()
    applyConfSettings(conf, { rows: { tree: { newick: '' } } })
    applyConfSettings(conf, { rows: { tree: { newick: OTHER } } })
    expect(treeOf(conf)).toEqual({ newick: OTHER, provenance: undefined })
  })

  test('a whole plot edit deleting the newick line drops the provenance', () => {
    const conf = clustered()
    const { rows } = plotOf(conf) as { rows: Record<string, unknown> }
    const draft = { rows: { ...rows, tree: { provenance: PROVENANCE } } }
    expect(plotWrites(conf, draft, { whole: true }).rows).toEqual({
      field: 'source',
      sort: ['b', 'a'],
    })
  })
})

// A launch arg `rows.sort=HG002` parses as one string, which failed the whole
// `rows` key and lost the `rows.field` beside it
test('a lone sort or kept value is a list of one, and the field beside it lands', () => {
  const conf = Display.create({ displayId: 's' })
  const report = applyConfSettings(conf, {
    rows: { field: 'source', sort: 'HG002', kept: 7 },
  })
  expect(report.failed).toEqual([])
  expect(readConfObject(conf, ['rows', 'field'])).toBe('source')
  expect(readConfObject(conf, ['rows', 'sort'])).toEqual(['HG002'])
  expect(readConfObject(conf, ['rows', 'kept'])).toEqual(['7'])
})

test('an empty sort is none, and a value no list reads is refused', () => {
  const conf = Display.create({ displayId: 's', rows: { sort: '' } })
  expect(readConfObject(conf, ['rows', 'sort'])).toEqual([])
  expect(applyConfSettings(conf, { rows: { sort: { a: 1 } } }).failed).toEqual([
    expect.objectContaining({
      error: expect.stringMatching(/rows\.sort is a list/),
    }),
  ])
})
