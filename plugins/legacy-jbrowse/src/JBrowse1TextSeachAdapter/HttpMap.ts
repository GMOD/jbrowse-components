/*
 * Helper class allows reading names index generated in JBrowse1
 * Adapted from https://github.com/GMOD/jbrowse/blob/master/src/JBrowse/Store/Hash.js
 */
import { crc32 } from './Crc32'

export default class HttpMap {
  constructor(args) {
    // make sure url has a trailing slash
    this.url = /\/$/.test(args.url) ? args.url : `${args.url}/`
    this.browser = args.browser
    this.meta = {}
    this.isElectron = args.isElectron

    // this.ready is a Deferred that will be resolved when we have
    // read the meta.json file with the params of this hashstore
    // this.ready = this.readMeta()
    this.ready = this.readMeta()
  }

  /**
   * loads meta.json file from names directory and reads number of hash_bits used
   */
  async readMeta() {
    try {
      this.meta = await this.loadFile('meta.json')
      this.meta.hash_hex_characters = Math.ceil(this.meta.hash_bits / 4)
      return true
    } catch (err) {
      throw Error(err)
    }
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
    await this.ready
    const bucketIdent = this.hash(key)
    try {
      const value = await this.loadFile(this.hexToDirPath(bucketIdent))
      return value
    } catch (err) {
      if (this.isElectron || err.status === 404) {
        // 404 is expected if the name is not in the store
        return {}
      }
    }
    return {}
  }

  /**
   * Loads a file using the url and provided id.
   * Returns response object with contents of the file
   * @param id - string
   */
  async loadFile(id: string) {
    try {
      let response = await fetch(`${this.url}${id}`)
      response = await response.json()
      return response
    } catch (err) {
      // handle error
      throw Error(err)
    }
  }

  /**
   * Returns the corresponding path of the file given a hex string
   * @param hex - hex string
   */
  hexToDirPath(hex: string) {
    // zero-pad the hex string to be 8 chars if necessary
    while (hex.length < 8) hex = `0${hex}`
    hex = hex.substr(8 - this.meta.hash_hex_characters)
    const dirpath = []
    for (let i = 0; i < hex.length; i += 3) {
      dirpath.push(hex.substring(i, i + 3))
    }
    return `${dirpath.join('/')}.json${this.meta.compress ? 'z' : ''}`
  }

  /**
   * Returns crc32 hash given a string.
   * (Note: this is using JBrowse1 implementation of crc32.)
   * @param data - string
   */
  hash(data: string) {
    return crc32(data).toString(16).toLowerCase().replace('-', 'n')
  }
}
