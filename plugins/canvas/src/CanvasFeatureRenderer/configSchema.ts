import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config CanvasFeatureRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const CanvasFeatureRenderer = ConfigurationSchema(
  'CanvasFeatureRenderer',
  {
    /**
     * #slot
     */
    color1: {
      type: 'color',
      description: 'the main color of each feature',
      defaultValue: 'goldenrod',
      contextVariable: ['feature', 'theme'],
    },
    /**
     * #slot
     */
    color2: {
      type: 'color',
      description:
        'the secondary color of each feature, used for connecting lines, etc',
      defaultValue: 'jexl:theme.palette.segments.main',
      contextVariable: ['feature', 'theme'],
    },
    /**
     * #slot
     */
    color3: {
      type: 'color',
      description:
        'the tertiary color of each feature, often used for contrasting fills, like on UTRs',
      defaultValue: '#357089',
      contextVariable: ['feature', 'theme'],
    },

    /**
     * #slot
     */
    outline: {
      type: 'maybeColor',
      description: 'the outline for features',
      defaultValue: undefined,
      contextVariable: ['feature', 'theme'],
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      description: 'height in pixels of the main body of each feature',
      defaultValue: 10,
      contextVariable: ['feature', 'theme'],
    },
    /**
     * #slot
     */
    showLabels: {
      type: 'boolean',
      defaultValue: true,
    },

    /**
     * #slot
     */
    showDescriptions: {
      type: 'boolean',
      defaultValue: true,
    },

    /**
     * #slot
     */
    subfeatureLabels: {
      type: 'stringEnum',
      model: types.enumeration('subfeatureLabels', [
        'none',
        'below',
        'overlay',
      ]),
      description:
        'subfeature label display: "none" hides labels, "below" reserves extra space, "overlay" draws on top of feature',
      defaultValue: 'none',
    },

    /**
     * #slot
     */
    mouseover: {
      type: 'string',
      description:
        'the mouseover tooltip label for features. Available variables: feature (the feature object), label (evaluated name), description (evaluated description)',
      defaultValue: `jexl:get(feature,'_mouseOver') || (label && description ? label + '<br/>' + description : (label || description || ''))`,
      contextVariable: ['feature', 'label', 'description'],
    },

    /**
     * #slot
     */
    subfeatureMouseover: {
      type: 'string',
      description:
        'the mouseover tooltip label for subfeatures (e.g. transcripts). Available variables: feature (the subfeature object)',
      defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
      contextVariable: ['feature'],
    },

    labels: ConfigurationSchema('CanvasFeatureLabels', {
      /**
       * #slot labels.name
       */
      name: {
        type: 'string',
        description:
          'the primary name of the feature to show, if space is available',
        defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
        contextVariable: ['feature'],
      },
      /**
       * #slot labels.nameColor
       */
      nameColor: {
        type: 'color',
        description: 'the color of the name label, if shown',
        defaultValue: `jexl:theme.palette.text.primary`,
        contextVariable: ['feature', 'theme'],
      },
      /**
       * #slot labels.description
       */
      description: {
        type: 'string',
        description: 'the text description to show, if space is available',
        defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
        contextVariable: ['feature', 'theme'],
      },
      /**
       * #slot labels.descriptionColor
       */
      descriptionColor: {
        type: 'color',
        description: 'the color of the description, if shown',
        defaultValue: `jexl:theme.palette.description.main`,
        contextVariable: ['feature', 'theme'],
      },

      /**
       * #slot labels.fontSize
       */
      fontSize: {
        type: 'number',
        description:
          'height in pixels of the text to use for names and descriptions',
        defaultValue: 12,
        contextVariable: ['feature', 'theme'],
      },
    }),

    /**
     * #slot
     */
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

    /**
     * #slot
     */
    maxFeatureGlyphExpansion: {
      type: 'number',
      description:
        "maximum number of pixels on each side of a feature's bounding coordinates that a glyph is allowed to use",
      defaultValue: 500,
    },

    /**
     * #slot
     */
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a rendering',
      defaultValue: 1200,
    },

    /**
     * #slot
     */
    subParts: {
      type: 'string',
      description: 'subparts for a glyph',
      defaultValue: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    },

    /**
     * #slot
     */
    impliedUTRs: {
      type: 'boolean',
      description: 'imply UTR from the exon and CDS differences',
      defaultValue: false,
    },
    /**
     * #slot
     */
    transcriptTypes: {
      type: 'stringArray',
      defaultValue: ['mRNA', 'transcript', 'primary_transcript'],
    },
    /**
     * #slot
     */
    containerTypes: {
      type: 'stringArray',
      defaultValue: ['proteoform_orf'],
    },

    /**
     * #slot
     */
    geneGlyphMode: {
      type: 'stringEnum',
      model: types.enumeration('geneGlyphMode', [
        'all',
        'longest',
        'longestCoding',
      ]),
      description:
        'Gene glyph display mode: "all" shows all transcripts, "longest" shows only the longest transcript, "longestCoding" shows only the longest coding transcript',
      defaultValue: 'all',
    },

    /**
     * #slot
     */
    displayDirectionalChevrons: {
      type: 'boolean',
      description:
        'Display directional chevrons on intron lines to indicate strand direction',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)

export default CanvasFeatureRenderer
