import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

/**
 * #config SharedVariantDisplay
 */
export default function sharedVariantConfigFactory() {
  return ConfigurationSchema(
    'SharedVariantDisplay',
    {
      /**
       * #slot
       */
      showReferenceAlleles: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Starting value for drawing reference alleles. When false, the row background is filled solid grey and only ALT alleles are painted on top (makes overlapping variants easier to see); when true, reference alleles are drawn normally. Seeds referenceDrawingMode the first time a config is loaded.',
      },
      /**
       * #slot
       */
      showSidebarLabels: {
        type: 'boolean',
        defaultValue: true,
        description: 'Show the per-sample row labels in the sidebar',
      },
      /**
       * #slot
       */
      showTree: {
        type: 'boolean',
        defaultValue: true,
        description: 'Show the sample clustering tree in the sidebar',
      },
      /**
       * #slot
       */
      showBranchLength: {
        type: 'boolean',
        defaultValue: true,
        description: 'Draw the clustering tree with branch lengths',
      },
      /**
       * #slot
       */
      renderingMode: {
        type: 'stringEnum',
        model: types.enumeration('RenderingMode', ['alleleCount', 'phased']),
        defaultValue: 'alleleCount',
        description:
          "'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws one row per haplotype",
      },
      /**
       * #slot
       * Optional per-feature color for the genotype cells: a jexl expression (or
       * plain CSS color) evaluated once per variant in the worker, painting every
       * alt-carrying cell with that color while ref/no-call cells keep their
       * normal coloring so "who carries it" still reads. Empty means the default
       * genotype-based coloring (allele dosage / phasing). The "Color by..."
       * menu offers presets like consequence impact
       * (`jexl:impactColor(feature)`), but any feature jexl works, same as the
       * standard `color` slot.
       */
      featureColor: {
        type: 'string',
        defaultValue: '',
      },
      /**
       * #slot
       */
      minorAlleleFrequencyFilter: {
        type: 'number',
        defaultValue: 0,
        advanced: true,
        description:
          'Hide variants whose minor allele frequency is below this threshold',
      },
      /**
       * #slot
       */
      maxMissingnessFilter: {
        type: 'number',
        defaultValue: 1,
        advanced: true,
        description:
          'Hide variants whose fraction of no-call (missing) genotypes is above this threshold; 1 keeps every variant',
      },
      /**
       * #slot
       */
      colorBy: {
        type: 'string',
        defaultValue: '',
        description:
          "Name of a sample-metadata attribute (a column in the adapter's samplesTsvLocation, e.g. 'population') to color the sidebar rows by; empty means no grouping",
      },
      /**
       * #slot
       * A 'draw'/'skip' toggle for reference alleles, settable independent of
       * showReferenceAlleles (the admin-config-only starting default). No
       * fallback derivation at read time — preProcessSnapshot below seeds this
       * from showReferenceAlleles once, the first time a config lacking it is
       * hydrated, so from then on this slot alone is the single source of truth.
       */
      referenceDrawingMode: {
        type: 'stringEnum',
        model: types.enumeration('ReferenceDrawingMode', ['draw', 'skip']),
        defaultValue: 'skip',
        description:
          "'draw' paints reference alleles; 'skip' fills the background solid grey and draws only ALT alleles",
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
      preProcessSnapshot: (snap: Record<string, unknown>) =>
        snap.referenceDrawingMode === undefined &&
        snap.showReferenceAlleles !== undefined
          ? {
              ...snap,
              referenceDrawingMode: snap.showReferenceAlleles ? 'draw' : 'skip',
            }
          : snap,
    },
  )
}

export type SharedVariantConfigModel = ReturnType<typeof sharedVariantConfigFactory>
