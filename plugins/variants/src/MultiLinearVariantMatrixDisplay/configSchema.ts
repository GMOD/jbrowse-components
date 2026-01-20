import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from '@jbrowse/mobx-state-tree'

import configSchema from '../MultiLinearVariantMatrixRenderer/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearVariantMatrixDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearVariantMatrixDisplay',
    {
      /**
       * #slot
       * MultiLinearVariantMatrixRenderer
       */
      renderer: configSchema,

      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 250,
      },

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
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
