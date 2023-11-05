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
    color: {
      type: 'color',
      description: 'the color of the arcs',
      defaultValue: 'darkblue',
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    thickness: {
      type: 'number',
      description: 'the thickness of the arcs',
      defaultValue: `jexl:logThickness(feature,'score')`,
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    label: {
      type: 'string',
      description: 'the label to appear at the apex of the arcs',
      defaultValue: `jexl:get(feature,'score')`,
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      description: 'the height of the arcs',
      defaultValue: `jexl:log10(get(feature,'end')-get(feature,'start'))*50`,
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    caption: {
      type: 'string',
      description:
        'the caption to appear when hovering over any point on the arcs',
      defaultValue: `jexl:get(feature,'name')`,
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    displayMode: {
      type: 'enum',
      defaultValue: 'arcs',
      model: types.enumeration('DisplayMode', ['arcs', 'semicircles']),
      description: 'render semi-circles instead of arcs',
    },
  },
  { explicitlyTyped: true },
)
export default ArcRenderer
