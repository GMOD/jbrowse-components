import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'

import linearWiggleDisplayConfigSchema from '../LinearWiggleDisplay/configSchema.ts'
import { quantitativeRowsConfigSchema } from '../shared/quantitativeRowsConfigSchema.ts'
import { wiggleMarkWithoutExtent } from '../shared/wiggleMarkWithoutExtent.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config WiggleRows
 * #category display
 * The `rows` of a `LinearWiggleDisplay` on a `MultiQuantitativeTrack`: a
 * [QuantitativeRows](../quantitativerows) whose `field` defaults to `source`,
 * so each subtrack draws its own row.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', rows: { field: '' } }
 * ```
 */
const rowPerSource = ConfigurationSchema(
  'WiggleRows',
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
