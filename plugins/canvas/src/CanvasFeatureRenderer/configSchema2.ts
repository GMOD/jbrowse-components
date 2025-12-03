import { ConfigurationSchema } from '@jbrowse/core/configuration'
import configSchema from './configSchema.ts'

/**
 * #config SvgFeatureRenderer
 * NOTE: This is a fake config for SvgFeatureRenderer which was deleted, please
 * update to use the real CanvasFeatureRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const SvgFeatureRenderer = ConfigurationSchema(
  'SvgFeatureRenderer',
  {},
  { explicitlyTyped: true, baseConfiguration: configSchema },
)

export default SvgFeatureRenderer
