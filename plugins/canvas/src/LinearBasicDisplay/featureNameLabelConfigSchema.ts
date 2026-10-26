import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { FEATURE_NAME_FIELD } from '../RenderFeatureDataRPC/featureNameField.ts'

/**
 * #config FeatureNameLabel
 * #category display
 * The feature displays' `labels.name`, the name drawn beside each feature:
 * whether it `show`s, and the `field` it reads. A bare string is the field.
 * Shown names still hide where the on-screen feature density passes
 * `maxLabelFeatureDensity`.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', labels: { name: 'gene_name' } }
 * ```
 */
export const featureNameLabelConfigSchema = ConfigurationSchema(
  'FeatureNameLabel',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw a name beside each feature',
    },
    /**
     * #slot
     */
    field: {
      type: 'featureField',
      defaultValue: FEATURE_NAME_FIELD,
      description:
        'the field the name reads, such as `gene_name`, or a `jexl:` expression over `feature`; the default reads the name, else the ID, and an empty value draws no name',
    },
  },
  { shorthand: 'field', writes: 'members', closed: true, plot: true },
)
