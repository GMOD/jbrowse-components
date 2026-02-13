process.env.NODE_ENV = 'development'

import configTransform from './config.ts'
import configFactory from '../../../webpack/config/webpack.config.ts'
import startServer from '../../../webpack/scripts/start.ts'

startServer(configTransform(configFactory()))
