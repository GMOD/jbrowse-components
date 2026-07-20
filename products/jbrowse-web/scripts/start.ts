import configFactory from '../../../webpack/config/webpack.config.ts'
import startServer from '../../../webpack/scripts/start.ts'
import configTransform from './config.ts'

process.env.NODE_ENV ??= 'development'

startServer(configTransform(configFactory()))
