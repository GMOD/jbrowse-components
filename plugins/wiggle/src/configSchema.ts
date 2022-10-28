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
    color: {
      type: 'color',
      description: 'the color of track, overrides posColor and negColor',
      defaultValue: '#f0f',
    },
    /**
     * #slot
     */
    posColor: {
      type: 'color',
      description: 'the color to use when the score is positive',
      defaultValue: 'blue',
    },
    /**
     * #slot
     */
    negColor: {
      type: 'color',
      description: 'the color to use when the score is negative',
      defaultValue: 'red',
    },
    /**
     * #slot
     */
    clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    },
    /**
     * #slot
     */
    bicolorPivot: {
      type: 'stringEnum',
      model: types.enumeration('Scale type', [
        'numeric',
        'mean',
        'z_score',
        'none',
      ]),
      description: 'type of bicolor pivot',
      defaultValue: 'numeric',
    },
    /**
     * #slot
     */
    bicolorPivotValue: {
      type: 'number',
      defaultValue: 0,
      description: 'value to use for bicolor pivot',
    },
  },
  { explicitlyTyped: true },
)
export default WiggleRenderer
