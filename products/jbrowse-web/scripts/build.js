// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production'
process.env.NODE_ENV = 'production'

const configFactory = require('../../../webpack/config/webpack.config')
const build = require('../../../webpack/scripts/build')
const configTransform = require('./config')

build(configTransform(configFactory('production')))
