import { ConfigurationSchema } from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

/**
 * #config SvgFeatureRenderer
 * @deprecated SvgFeatureRenderer was removed. Use CanvasFeatureRenderer instead.
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const SvgFeatureRenderer = ConfigurationSchema(
  'SvgFeatureRenderer',
  {},
  { explicitlyTyped: true, baseConfiguration: configSchema },
)

export default SvgFeatureRenderer
