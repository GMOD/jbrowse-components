import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

/**
 * #config SharedVariantDisplay
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
export default function sharedVariantConfigFactory() {
  return ConfigurationSchema(
    'SharedVariantDisplay',
    {
      /**
       * #slot
       * When true, reference alleles are drawn/colored. When false, the
       * background is solid grey and only ALT alleles are colored on top
       */
      showReferenceAlleles: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot
       */
      showSidebarLabels: {
        type: 'boolean',
        defaultValue: true,
      },
      /**
       * #slot
       */
      showTree: {
        type: 'boolean',
        defaultValue: true,
      },
      /**
       * #slot
       * The rendering mode: 'alleleCount' shows dosage (darker color for
       * homozygous), 'phased' splits samples into haplotype rows
       */
      renderingMode: {
        type: 'stringEnum',
        model: types.enumeration('RenderingMode', ['alleleCount', 'phased']),
        defaultValue: 'alleleCount',
      },
      /**
       * #slot
       * Filter variants by minor allele frequency (0-1). Variants with MAF
       * below this threshold will be hidden
       */
      minorAlleleFrequencyFilter: {
        type: 'number',
        defaultValue: 0,
      },
      /**
       * #slot
       * Automatically color samples by this metadata attribute when the track
       * loads. The attribute must be present in the sample metadata TSV file
       * (configured via samplesTsvLocation on the adapter). Leave empty to
       * disable auto-coloring.
       */
      colorBy: {
        type: 'string',
        defaultValue: '',
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
