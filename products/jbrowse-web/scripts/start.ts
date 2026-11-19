import configFactory from '../../../config/webpack/config/webpack.config.ts'
import startServer from '../../../config/webpack/scripts/start.ts'
import configTransform from './config.ts'

startServer(configTransform(configFactory()))
