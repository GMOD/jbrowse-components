const configFactory = require('../../../webpack/config/webpack.config')
const build = require('../../../webpack/scripts/build')
build(configFactory('production'))
