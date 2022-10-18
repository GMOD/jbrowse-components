import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { default as divSequenceRendererConfigSchema } from '../DivSequenceRenderer/configSchema'

/**
 * !config LinearReferenceSequenceDisplay
 */
export const configSchema = ConfigurationSchema(
  'LinearReferenceSequenceDisplay',
  {
    /**
     * !slot
     */
    renderer: divSequenceRendererConfigSchema,
  },
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)
