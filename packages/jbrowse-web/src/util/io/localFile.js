const promisify = require('util.promisify')

// don't load fs native module if running in webpacked code
const fs = typeof __webpack_require__ !== 'function' ? require('fs') : null // eslint-disable-line camelcase

const fsOpen = fs && promisify(fs.open)
const fsRead = fs && promisify(fs.read)
const fsFStat = fs && promisify(fs.fstat)
const fsReadFile = fs && promisify(fs.readFile)
export default class LocalFile {
  constructor(source) {
    this.position = 0
    this.filename = source
    if (!fsOpen)
      throw new Error(
        'local file opening not available in the current environment',
      )
    this.fd = fsOpen(this.filename, 'r')
  }

  async read(buffer, offset = 0, length, position) {
    let readPosition = position
    if (readPosition === null) {
      readPosition = this.position
      this.position += length
    }
    return fsRead(await this.fd, buffer, offset, length, position)
  }

  async readFile() {
    return fsReadFile(await this.fd)
  }

  async stat() {
    if (!this.statCache) {
      this.statCache = await fsFStat(await this.fd)
    }
    return this.statCache
  }
}
