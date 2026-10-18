import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { featureFilterConfigSchema } from '@jbrowse/display-kit/featureFilterConfigSchema'

/**
 * #config VariantFilter
 * #category display
 * The tests the multi-sample variant display applies to the records it
 * fetched, its `filter`: the jexl `expressions` every feature filter takes,
 * and two thresholds on what the record's genotypes say about the site.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMultiSampleVariantDisplay',
 *   filter: { minMinorAlleleFrequency: 0.05, maxMissingness: 0.1 },
 * }
 * ```
 */
export const variantFilterConfigSchema = ConfigurationSchema(
  'VariantFilter',
  {
    /**
     * #slot
     * A variant draws only when its minor allele, the second most frequent
     * of its called alleles, makes up at least this share of them. At most
     * 0.5; 0 keeps every variant.
     */
    minMinorAlleleFrequency: {
      type: 'number',
      defaultValue: 0,
      description:
        'a variant draws only with a minor allele frequency of at least this; 0 keeps every variant',
    },
    /**
     * #slot
     */
    maxMissingness: {
      type: 'number',
      defaultValue: 1,
      description:
        'a variant draws only with at most this share of its alleles uncalled; 1 keeps every variant',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: featureFilterConfigSchema,
  },
)
