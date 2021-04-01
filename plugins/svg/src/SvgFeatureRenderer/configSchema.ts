import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'SvgFeatureRenderer',
  {
    color1: {
      type: 'color',
      description: 'the main color of each feature',
      defaultValue: 'goldenrod',
      contextVariable: ['feature'],
    },
    color2: {
      type: 'color',
      description:
        'the secondary color of each feature, used for connecting lines, etc',
      defaultValue: 'black',
      contextVariable: ['feature'],
    },
    color3: {
      type: 'color',
      description:
        'the tertiary color of each feature, often used for contrasting fills, like on UTRs',
      defaultValue: '#357089',
      contextVariable: ['feature'],
    },
    height: {
      type: 'number',
      description: 'height in pixels of the main body of each feature',
      defaultValue: 10,
      contextVariable: ['feature'],
    },
    showLabels: {
      type: 'boolean',
      defaultValue: true,
    },
    labels: ConfigurationSchema('SvgFeatureLabels', {
      name: {
        type: 'string',
        description:
          'the primary name of the feature to show, if space is available',
        defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
        contextVariable: ['feature'],
      },
      nameColor: {
        type: 'color',
        description: 'the color of the name label, if shown',
        defaultValue: 'black',
        contextVariable: ['feature'],
      },
      description: {
        type: 'string',
        description: 'the text description to show, if space is available',
        defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
        contextVariable: ['feature'],
      },
      descriptionColor: {
        type: 'color',
        description: 'the color of the description, if shown',
        defaultValue: 'blue',
        contextVariable: ['feature'],
      },
      fontSize: {
        type: 'number',
        description:
          'height in pixels of the text to use for names and descriptions',
        defaultValue: 13,
        contextVariable: ['feature'],
      },
    }),
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
    maxFeatureGlyphExpansion: {
      type: 'number',
      description:
        "maximum number of pixels on each side of a feature's bounding coordinates that a glyph is allowed to use",
      defaultValue: 500,
    },
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a svg rendering',
      defaultValue: 600,
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
  },
  { explicitlyTyped: true },
)
