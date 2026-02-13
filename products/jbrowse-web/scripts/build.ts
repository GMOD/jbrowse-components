process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'

import configTransform from './config.ts'
import configFactory from '../../../webpack/config/webpack.config.js'
import build from '../../../webpack/scripts/build.js'

void build(configTransform(configFactory()))
