import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { default as divSequenceRendererConfigSchema } from '../DivSequenceRenderer/configSchema'

/**
 * #config LinearReferenceSequenceDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export const configSchema = ConfigurationSchema(
  'LinearReferenceSequenceDisplay',
  {
    /**
     * #slot
     */
    renderer: divSequenceRendererConfigSchema,
  },
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)
