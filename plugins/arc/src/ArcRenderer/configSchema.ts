import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

/**
 * #config ArcRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const ArcRenderer = ConfigurationSchema(
  'ArcRenderer',
  {
    /**
     * #slot
     */
    caption: {
      contextVariable: ['feature'],
      defaultValue: `jexl:get(feature,'name')`,
      description:
        'the caption to appear when hovering over any point on the arcs',
      type: 'string',
    },

    /**
     * #slot
     */
    color: {
      contextVariable: ['feature'],
      defaultValue: 'darkblue',
      description: 'the color of the arcs',
      type: 'color',
    },

    /**
     * #slot
     */
    displayMode: {
      defaultValue: 'arcs',
      description: 'render semi-circles instead of arcs',
      model: types.enumeration('DisplayMode', ['arcs', 'semicircles']),
      type: 'enum',
    },

    /**
     * #slot
     */
    height: {
      contextVariable: ['feature'],
      defaultValue: `jexl:log10(get(feature,'end')-get(feature,'start'))*50`,
      description: 'the height of the arcs',
      type: 'number',
    },

    /**
     * #slot
     */
    label: {
      contextVariable: ['feature'],
      defaultValue: `jexl:get(feature,'score')`,
      description: 'the label to appear at the apex of the arcs',
      type: 'string',
    },

    /**
     * #slot
     */
    thickness: {
      contextVariable: ['feature'],
      defaultValue: `jexl:logThickness(feature,'score')`,
      description: 'the thickness of the arcs',
      type: 'number',
    },
  },
  { explicitlyTyped: true },
)
export default ArcRenderer
