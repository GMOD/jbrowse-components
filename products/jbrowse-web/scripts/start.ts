process.env.NODE_ENV = 'development'

import configTransform from './config.ts'
import configFactory from '../../../webpack/config/webpack.config.js'
import startServer from '../../../webpack/scripts/start.js'

startServer(configTransform(configFactory()))
