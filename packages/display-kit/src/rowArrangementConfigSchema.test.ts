import {
  ConfigurationSchema,
  getConfigurationSchemaMetadata,
} from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  ROW_ARRANGEMENT_MEMBERS,
  rowArrangementConfigSchema,
} from './rowArrangementConfigSchema.ts'

// "Reset row order" and the arrangement writers walk the list, so a slot
// missing from it survives a reset.
test('the arrangement members are every RowArrangement slot', () => {
  const slots = Object.keys(
    getConfigurationSchemaMetadata(rowArrangementConfigSchema)!.definition,
  )
  expect([...ROW_ARRANGEMENT_MEMBERS].sort()).toEqual(slots.sort())
})

// hosted hub configs jb2hubs generated before the rename
const BETA = 'domain'
test('rows written with the beta `domain` read as their `sort`', () => {
  const Display = ConfigurationSchema('RowsHost', {
    rows: rowArrangementConfigSchema,
  })
  expect(getSnapshot(Display.create({ rows: { [BETA]: ['b', 'a'] } }))).toEqual(
    { rows: { sort: ['b', 'a'] } },
  )
})
