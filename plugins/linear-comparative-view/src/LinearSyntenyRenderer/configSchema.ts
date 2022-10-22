import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearSyntenyRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const LinearSyntenyRenderer = ConfigurationSchema(
  'LinearSyntenyRenderer',
  {
    /**
     * #slot
     */
    color: {
      type: 'color',
      description: 'the color of each feature in a synteny',
      defaultValue: 'rgb(255,100,100,0.3)',
    },
  },
  { explicitlyTyped: true },
)
export default LinearSyntenyRenderer
