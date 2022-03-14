var nodeCrypto = require('crypto')

global.crypto = {
  getRandomValues: buffer => nodeCrypto.randomFillSync(buffer),
}
