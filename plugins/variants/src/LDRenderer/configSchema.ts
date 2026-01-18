import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LDRenderer
 * #category renderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const LDRenderer = ConfigurationSchema(
  'LDRenderer',
  {
    /**
     * #slot
     */
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in LD rendering',
      defaultValue: 600,
    },
  },
  { explicitlyTyped: true },
)

export default LDRenderer
