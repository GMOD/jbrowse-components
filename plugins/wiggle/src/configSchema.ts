import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

/**
 * #config WiggleRenderer
 * this is the "base wiggle renderer config schema"
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const WiggleRenderer = ConfigurationSchema(
  'WiggleRenderer',
  {
    /**
     * #slot
     */
    bicolorPivot: {
      defaultValue: 'numeric',
      description: 'type of bicolor pivot',
      model: types.enumeration('Scale type', [
        'numeric',
        'mean',
        'z_score',
        'none',
      ]),
      type: 'stringEnum',
    },

    /**
     * #slot
     */
    bicolorPivotValue: {
      defaultValue: 0,
      description: 'value to use for bicolor pivot',
      type: 'number',
    },

    /**
     * #slot
     */
    clipColor: {
      defaultValue: 'red',
      description: 'the color of the clipping marker',
      type: 'color',
    },

    /**
     * #slot
     */
    color: {
      defaultValue: '#f0f',
      description: 'the color of track, overrides posColor and negColor',
      type: 'color',
    },

    /**
     * #slot
     */
    negColor: {
      defaultValue: 'red',
      description: 'the color to use when the score is negative',
      type: 'color',
    },

    /**
     * #slot
     */
    posColor: {
      defaultValue: 'blue',
      description: 'the color to use when the score is positive',
      type: 'color',
    },
  },
  { explicitlyTyped: true },
)
export default WiggleRenderer
