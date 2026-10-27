import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import linearWiggleDisplayConfigSchema from '../LinearWiggleDisplay/configSchema.ts'
import { quantitativeRowsConfigSchema } from '../shared/quantitativeRowsConfigSchema.ts'
import { wiggleMarkWithoutExtent } from '../shared/wiggleMarkWithoutExtent.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const rowPerSource = ConfigurationSchema(
  'Rows',
  {
    field: {
      type: 'stringEnum',
      model: types.enumeration('QuantitativeRowsField', ['', 'source']),
      // '' stays a member, not unset: under this default, unset could not
      // say "one plot every source shares"
      defaultValue: 'source',
      description:
        'source for one row per subtrack, or empty for one plot every source shares',
    },
  },
  { baseConfiguration: quantitativeRowsConfigSchema },
)

export const multiQuantitativeWiggleConfigSchema = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    rows: rowPerSource,
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
