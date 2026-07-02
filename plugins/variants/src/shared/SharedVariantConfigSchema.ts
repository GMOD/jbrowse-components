import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

export const sharedVariantConfigSlots = {
  showReferenceAlleles: {
    type: 'boolean',
    defaultValue: false,
  },
  showSidebarLabels: {
    type: 'boolean',
    defaultValue: true,
  },
  showTree: {
    type: 'boolean',
    defaultValue: true,
  },
  showBranchLength: {
    type: 'boolean',
    defaultValue: false,
  },
  renderingMode: {
    type: 'stringEnum',
    model: types.enumeration('RenderingMode', ['alleleCount', 'phased']),
    defaultValue: 'alleleCount',
  },
  // Optional per-feature color for the genotype cells: a jexl expression (or
  // plain CSS color) evaluated once per variant in the worker, painting every
  // alt-carrying cell with that color while ref/no-call cells keep their normal
  // coloring so "who carries it" still reads. Empty means the default
  // genotype-based coloring (allele dosage / phasing). The "Color cells by"
  // menu offers presets like consequence impact (jexl:impactColor(feature)),
  // but any feature jexl works, same as the standard `color` slot.
  featureColor: {
    type: 'string',
    defaultValue: '',
  },
  minorAlleleFrequencyFilter: {
    type: 'number',
    defaultValue: 0,
    advanced: true,
  },
  colorBy: {
    type: 'string',
    defaultValue: '',
  },
  // 'draw'/'skip' toggle for reference alleles, settable independent of
  // showReferenceAlleles (the admin-config-only starting default). No
  // fallback derivation at read time — preProcessSnapshot below seeds this
  // from showReferenceAlleles once, the first time a config lacking it is
  // hydrated, so from then on this slot alone is the single source of truth.
  referenceDrawingMode: {
    type: 'stringEnum',
    model: types.enumeration('ReferenceDrawingMode', ['draw', 'skip']),
    defaultValue: 'skip',
  },
}

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
      ...sharedVariantConfigSlots,
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
