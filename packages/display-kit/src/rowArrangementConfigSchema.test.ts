import { getConfigurationSchemaMetadata } from '@jbrowse/core/configuration'

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
