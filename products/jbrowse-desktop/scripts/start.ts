process.env.NODE_ENV = 'development'

import desktopConfig from './config.ts'
import configFactory from '../../../webpack/config/webpack.config.ts'
import startServer from '../../../webpack/scripts/start.ts'

startServer(desktopConfig(configFactory()))
