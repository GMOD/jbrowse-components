const baseConfigFactory = require('../../babel.config.js')
module.exports = (api) => {
  const config = baseConfigFactory(api)
  config.presets.push('react-app')
  return config
}
