import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
      // `function` is the only human-readable text on structural features
      // that carry no note; read via get() since it is a reserved word in the
      // grammar.
      defaultValue: `jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')`,
      description:
        'the field the description reads, such as `note`, or a `jexl:` expression over `feature`; the default reads `note`, else `description`, else `function`, and an empty value draws no description',
    },
  },
  { shorthand: 'field', writes: 'members', closed: true, plot: true },
)
