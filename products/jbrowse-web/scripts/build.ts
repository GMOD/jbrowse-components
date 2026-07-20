import configFactory from '../../../webpack/config/webpack.config.ts'
import build from '../../../webpack/scripts/build.ts'
import configTransform from './config.ts'

process.env.BABEL_ENV ??= 'production'
process.env.NODE_ENV ??= 'production'

void build(configTransform(configFactory()))
