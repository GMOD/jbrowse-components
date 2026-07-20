import configFactory from '../../../webpack/config/webpack.config.ts'
import startServer from '../../../webpack/scripts/start.ts'
import desktopConfig from './config.ts'

startServer(desktopConfig(configFactory()))
