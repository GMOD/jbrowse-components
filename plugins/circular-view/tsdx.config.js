// eslint-disable-next-line import/no-extraneous-dependencies
const scss = require('rollup-plugin-scss')

module.exports = {
  rollup(config) {
    config.plugins.push(scss())
    return config
  },
}
