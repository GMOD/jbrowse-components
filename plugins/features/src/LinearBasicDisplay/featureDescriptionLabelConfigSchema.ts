import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { FEATURE_DESCRIPTION_FIELD } from '../RenderFeatureDataRPC/featureNameField.ts'

/**
 * #config FeatureDescriptionLabel
 * #category display
 * The feature displays' `labels.description`, the line drawn under each
 * feature's name: whether it `show`s, and the `field` it reads. A bare string
 * is the field. Shown descriptions still hide where features crowd the
 * screen, a zoom step before names do, whether or not names draw.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', labels: { description: { show: false } } }
 * ```
 */
export const featureDescriptionLabelConfigSchema = ConfigurationSchema(
  'FeatureDescriptionLabel',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw a description line under each feature',
    },
    /**
     * #slot
     */
    field: {
      type: 'featureField',
      defaultValue: FEATURE_DESCRIPTION_FIELD,
      description:
        'the field the description reads, such as `note`, or a `jexl:` expression over `feature`; the default reads `note`, else `description`, else `function`, and an empty value draws no description',
    },
  },
  { shorthand: 'field', writes: 'members', closed: true, plot: true },
)
