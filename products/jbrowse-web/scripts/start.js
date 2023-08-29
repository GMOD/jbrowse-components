const configFactory = require('../../../webpack/config/webpack.config')
const startServer = require('../../../webpack/scripts/start')
startServer(configFactory('development'))
