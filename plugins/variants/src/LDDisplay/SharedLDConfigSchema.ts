import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

/**
 * #config SharedLDDisplay
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
export default function sharedLDConfigFactory() {
  return ConfigurationSchema(
    'SharedLDDisplay',
    {
      /**
       * #slot
       * Filter variants by minor allele frequency (0-1). Variants with MAF
       * below this threshold will be hidden
       */
      minorAlleleFrequencyFilter: {
        type: 'number',
        defaultValue: 0.1,
      },
      /**
       * #slot
       * Maximum length of variants to include (in bp)
       */
      lengthCutoffFilter: {
        type: 'number',
        defaultValue: Number.MAX_SAFE_INTEGER,
      },
      /**
       * #slot
       * Height of the zone for connecting lines at the top
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       * LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D)
       */
      ldMetric: {
        type: 'stringEnum',
        model: types.enumeration('LDMetric', ['r2', 'dprime']),
        defaultValue: 'r2',
      },
      /**
       * #slot
       * Color scheme for the LD heatmap
       */
      colorScheme: {
        type: 'string',
        defaultValue: '',
      },
      /**
       * #slot
       * Whether to show the legend
       */
      showLegend: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot
       * Whether to show the LD triangle heatmap
       */
      showLDTriangle: {
        type: 'boolean',
        defaultValue: true,
      },
      /**
       * #slot
       * Whether to show the recombination rate track
       */
      showRecombination: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot
       * Height of the recombination track zone at the top
       */
      recombinationZoneHeight: {
        type: 'number',
        defaultValue: 50,
      },
      /**
       * #slot
       * When true, squash the LD triangle to fit the display height
       */
      fitToHeight: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot
       * HWE filter p-value threshold (variants with HWE p < this are excluded).
       * Set to 0 to disable HWE filtering
       */
      hweFilterThreshold: {
        type: 'number',
        defaultValue: 0,
      },
      /**
       * #slot
       * Whether to show vertical guides at the connected genome positions on hover
       */
      showVerticalGuides: {
        type: 'boolean',
        defaultValue: true,
      },
      /**
       * #slot
       * Whether to show variant labels above the tick marks
       */
      showLabels: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot
       * Height of the vertical tick marks at the genomic position
       */
      tickHeight: {
        type: 'number',
        defaultValue: 6,
      },
      /**
       * #slot
       * When true, draw cells sized according to genomic distance between SNPs
       * rather than uniform squares
       */
      useGenomicPositions: {
        type: 'boolean',
        defaultValue: false,
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
