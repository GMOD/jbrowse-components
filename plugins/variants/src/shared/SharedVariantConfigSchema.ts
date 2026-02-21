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
  renderingMode: {
    type: 'stringEnum',
    model: types.enumeration('RenderingMode', ['alleleCount', 'phased']),
    defaultValue: 'alleleCount',
  },
  minorAlleleFrequencyFilter: {
    type: 'number',
    defaultValue: 0,
  },
  colorBy: {
    type: 'string',
    defaultValue: '',
  },
}

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
       */
      ...sharedVariantConfigSlots,
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
