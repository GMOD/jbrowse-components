import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import linearWiggleDisplayConfigSchema from '../LinearWiggleDisplay/configSchema.ts'
import { wiggleMarkWithoutExtent } from '../shared/wiggleMarkWithoutExtent.ts'
import { wiggleRowsConfigSchema } from './wiggleRowsConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export const multiQuantitativeWiggleConfigSchema = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    rows: wiggleRowsConfigSchema,
    ...trackHeightConfigSchemaFields({ defaultHeight: 200 }),
    mark: wiggleMarkWithoutExtent(),
  },
  { baseConfiguration: linearWiggleDisplayConfigSchema },
)

export function multiQuantitativeDisplaySchemas(pluginManager: PluginManager) {
  return types.array(
    types.union(
      ...pluginManager
        .getDisplayElements()
        .map(d =>
          d.configSchema === linearWiggleDisplayConfigSchema
            ? multiQuantitativeWiggleConfigSchema
            : d.configSchema,
        ),
    ),
  )
}
