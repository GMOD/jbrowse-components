const { createHash } = require('crypto')

module.exports = function createEnvironmentHash(env) {
  const hash = createHash('md5')
  hash.update(JSON.stringify(env))

  return hash.digest('hex')
}
