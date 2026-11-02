import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { rowsConfigSchema } from './rowsConfigSchema.ts'

/**
 * @deprecated no display's `rows` extends it: MAF's `rows` (`MafRows`) takes
 * no `field`, and the variant display's is `VariantRows`. Kept while
 * `@jbrowse/display-kit/sampleRowsConfigSchema` stays a served subpath; a
 * plugin wanting the arrangement extends `rowArrangementConfigSchema`.
 */
export const sampleRowsConfigSchema = ConfigurationSchema(
  'SampleRows',
  {
    field: {
      type: 'stringEnum',
      model: types.enumeration('SampleRowsField', ['sample']),
      defaultValue: 'sample',
      description: 'sample, the one field a row can be',
    },
  },
  { baseConfiguration: rowsConfigSchema },
)
