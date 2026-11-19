import configFactory from '../../../config/webpack/config/webpack.config.ts'
import build from '../../../config/webpack/scripts/build.ts'
import desktopConfig from './config.ts'

await build(desktopConfig(configFactory()), { omitFromPublic: ['test_data'] })
