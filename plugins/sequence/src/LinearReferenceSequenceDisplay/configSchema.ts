import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { configSchema as divSequenceRendererConfigSchema } from '../DivSequenceRenderer'

export const configSchema = ConfigurationSchema(
  'LinearReferenceSequenceDisplay',
  { renderer: divSequenceRendererConfigSchema },
  { implicitIdentifier: 'displayId', explicitlyTyped: true },
)
