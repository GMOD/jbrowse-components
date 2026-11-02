import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowsWithStepConfigSchema } from '@jbrowse/display-kit/rowsWithStepConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config VariantRows
 * #category display
 * The variant display's `rows`: one per sample, or per haplotype in phased
 * mode, with the [RowsWithStep](../rowswithstep) arrangement, axis and row
 * height.
 *
 * #example
 * ```js
 * { type: 'LinearVariantDisplay', rows: { sort: ['HG002'], step: 10 } }
 * ```
 */
export const variantRowsConfigSchema = ConfigurationSchema(
  'VariantRows',
  {
    /**
     * #slot field
     * `sample`, the one field a row of this display can be: a sample, or a
     * haplotype of one in phased mode.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('VariantRowsField', ['sample']),
      defaultValue: 'sample',
      description: 'sample, the one field a row can be',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowsWithStepConfigSchema,
  },
)
