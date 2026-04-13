import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {
      maxHeight: {
        type: 'number',
        defaultValue: 1200,
        description: 'Maximum height of the display in pixels',
      },
      maxFeatureScreenDensity: {
        type: 'number',
        defaultValue: 20,
        description:
          'Maximum features per pixel before showing region too large message',
      },
      autoHeight: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Automatically resize the track height to fit all features',
      },
      showLabels: {
        type: 'boolean',
        defaultValue: true,
        description: 'Show feature labels',
      },
      showDescriptions: {
        type: 'boolean',
        defaultValue: true,
        description: 'Show feature descriptions',
      },

      // Visual settings promoted from the old CanvasFeatureRenderer config.
      // These were previously nested under renderer: { type:
      // "CanvasFeatureRenderer", ... } but are now first-class display
      // settings. Old configs with the renderer block are migrated
      // automatically by baseTrackConfig preProcessSnapshot.
      color1: {
        type: 'color',
        description: 'the main color of each feature',
        defaultValue: 'goldenrod',
        contextVariable: ['feature'],
      },
      color2: {
        type: 'color',
        description:
          'the secondary color of each feature, used for connecting lines',
        defaultValue: '#f0f',
        contextVariable: ['feature'],
      },
      color3: {
        type: 'color',
        description: 'the tertiary color of each feature, used for UTRs',
        defaultValue: '#357089',
        contextVariable: ['feature'],
      },
      outline: {
        type: 'color',
        description: 'the outline for features',
        defaultValue: '',
        contextVariable: ['feature'],
      },
      featureHeight: {
        type: 'number',
        description: 'height in pixels of the main body of each feature',
        defaultValue: 10,
        contextVariable: ['feature'],
      },
      displayMode: {
        type: 'stringEnum',
        model: types.enumeration('displayMode', [
          'normal',
          'compact',
          'reducedRepresentation',
          'collapse',
        ]),
        description: 'Alternative display modes',
        defaultValue: 'normal',
      },
      geneGlyphMode: {
        type: 'stringEnum',
        model: types.enumeration('geneGlyphMode', [
          'auto',
          'all',
          'longest',
          'longestCoding',
        ]),
        description:
          'Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longest" shows only the longest, "longestCoding" shows only the longest coding',
        defaultValue: 'auto',
      },
      subfeatureLabels: {
        type: 'stringEnum',
        model: types.enumeration('subfeatureLabels', [
          'none',
          'below',
          'overlay',
        ]),
        description: 'subfeature label display mode',
        defaultValue: 'none',
      },
      displayDirectionalChevrons: {
        type: 'boolean',
        description:
          'Display directional chevrons on intron lines to indicate strand direction',
        defaultValue: true,
      },
      transcriptTypes: {
        type: 'stringArray',
        defaultValue: ['mRNA', 'transcript', 'primary_transcript'],
      },
      containerTypes: {
        type: 'stringArray',
        defaultValue: ['proteoform_orf'],
      },
      subParts: {
        type: 'string',
        description: 'subparts for a glyph',
        defaultValue: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
      },
      impliedUTRs: {
        type: 'boolean',
        description: 'imply UTR from the exon and CDS differences',
        defaultValue: false,
      },
      labels: ConfigurationSchema('CanvasFeatureLabels', {
        name: {
          type: 'string',
          description: 'the primary name of the feature to show',
          defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
          contextVariable: ['feature'],
        },
        nameColor: {
          type: 'color',
          description: 'the color of the name label',
          defaultValue: '#f0f',
          contextVariable: ['feature'],
        },
        description: {
          type: 'string',
          description: 'the text description to show',
          defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
          contextVariable: ['feature'],
        },
        descriptionColor: {
          type: 'color',
          description: 'the color of the description',
          defaultValue: 'blue',
          contextVariable: ['feature'],
        },
        fontSize: {
          type: 'number',
          description: 'font size in pixels for names and descriptions',
          defaultValue: 12,
          contextVariable: ['feature'],
        },
      }),
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
