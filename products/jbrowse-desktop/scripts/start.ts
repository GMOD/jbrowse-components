import configFactory from '../../../config/webpack/config/webpack.config.ts'
import startServer from '../../../config/webpack/scripts/start.ts'
import desktopConfig from './config.ts'

startServer(desktopConfig(configFactory()))
