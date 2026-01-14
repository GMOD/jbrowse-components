import { ConfigurationSchema } from '@jbrowse/core/configuration'

import divSequenceRendererConfigSchema from '../DivSequenceRenderer/configSchema.ts'

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
