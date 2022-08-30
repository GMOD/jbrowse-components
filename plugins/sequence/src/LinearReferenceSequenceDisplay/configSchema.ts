import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { default as divSequenceRendererConfigSchema } from '../DivSequenceRenderer/configSchema'

export const configSchema = ConfigurationSchema(
  'LinearReferenceSequenceDisplay',
  { renderer: divSequenceRendererConfigSchema },
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)
