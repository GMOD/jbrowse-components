process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'

import configTransform from './config.js'
import configFactory from '../../../webpack/config/webpack.config.js'
import build from '../../../webpack/scripts/build.js'

build(configTransform(configFactory()))
