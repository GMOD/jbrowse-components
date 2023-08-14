const baseConfig = require('../../config/webpack/base')

module.exports = function () {
  const base = baseConfig()
  base.target = 'electron-renderer'
  base.resolve.aliasFields = []
  base.resolve.mainFields = ['module', 'main']
  return base
}
