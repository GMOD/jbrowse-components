const baseConfig = require('../../.eslintrc')
const config = JSON.parse(JSON.stringify(baseConfig)) // deep clone
config.extends.push('react-app')
module.exports = config
