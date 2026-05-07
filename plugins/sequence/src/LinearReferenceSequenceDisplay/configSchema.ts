import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearReferenceSequenceDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export const configSchema = ConfigurationSchema(
  'LinearReferenceSequenceDisplay',
  {},
  { explicitIdentifier: 'displayId', explicitlyTyped: true },
)
