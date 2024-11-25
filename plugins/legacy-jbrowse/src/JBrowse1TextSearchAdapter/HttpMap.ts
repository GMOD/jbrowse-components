/**
 * Helper class allows reading names index generated in JBrowse1
 * Adapted from https://github.com/GMOD/jbrowse/blob/master/src/JBrowse/Store/Hash.js
 */
import { Buffer } from 'buffer'
import crc32 from 'crc/crc32'

export default class HttpMap {
  url: string

  constructor(args: { url: string }) {
    // make sure url has a trailing slash
    this.url = args.url.endsWith('/') ? args.url : `${args.url}/`
  }

  /**
   * loads meta.json file from names directory and reads number of hash_bits used
   */
  async readMeta() {
    const meta = await this.loadFile('meta.json')
    const { compress, track_names: tracks } = meta
    const hashHexCharacters = Math.ceil(meta.hash_bits / 4)
    return { hashHexCharacters, compress, tracks }
  }

  async getHashHexCharacters() {
    const meta = await this.readMeta()
    return meta.hashHexCharacters
  }

  async getCompress() {
    const meta = await this.readMeta()
    return meta.compress
  }

  async getTrackNames() {
    const meta = await this.readMeta()
    return meta.tracks
  }

  /**
   * Returns contents of a bucket given a key
   * @param key - string
   */
  async get(key: string) {
    const bucket = await this.getBucket(key)
    return bucket[key]
  }

  /**
   * Returns a bucket given a key
   * @param key - string
   */
  async getBucket(key: string) {
    const bucketIdent = this.hash(key)
    const hexToDirPath = await this.hexToDirPath(bucketIdent)
    return this.loadFile(hexToDirPath)
  }

  /**
   * Loads a file using the url and provided id.
   * Returns response object with contents of the file
   * @param id - string
   */
  async loadFile(id: string) {
    const response = await fetch(`${this.url}${id}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  /**
   * Returns the corresponding path of the file given a hex string
   * @param hex - hex string
   */
  async hexToDirPath(hex: string) {
    // zero-pad the hex string to be 8 chars if necessary
    const hashHexCharacters = await this.getHashHexCharacters()
    if (hashHexCharacters) {
      const compress = await this.getCompress()
      while (hex.length < 8) {
        hex = `0${hex}`
      }
      hex = hex.slice(8 - hashHexCharacters)
      const dirpath = []
      for (let i = 0; i < hex.length; i += 3) {
        dirpath.push(hex.slice(i, i + 3))
      }
      return `${dirpath.join('/')}.json${compress ? 'z' : ''}`
    }
    return ''
  }

  hash(data: string) {
    return crc32(Buffer.from(data)).toString(16).toLowerCase().replace('-', 'n')
  }
}
