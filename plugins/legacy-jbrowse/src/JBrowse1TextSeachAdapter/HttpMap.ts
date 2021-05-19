/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Helper class allows reading names index generated in JBrowse1
 * Adapted from https://github.com/GMOD/jbrowse/blob/master/src/JBrowse/Store/Hash.js
 */
import { crc32 } from './Crc32'

export default class HttpMap {
  url: string

  isElectron: boolean

  hash_hex_characters?: number

  compress?: number

  tracks?: string[]

  constructor(args: { url: string; isElectron: boolean }) {
    // make sure url has a trailing slash
    this.url = /\/$/.test(args.url) ? args.url : `${args.url}/`

    this.isElectron = args.isElectron
  }

  /**
   * loads meta.json file from names directory and reads number of hash_bits used
   */
  async readMeta() {
    try {
      const meta = await this.loadFile('meta.json')
      if (meta !== {}) {
        const { compress, track_names: tracks } = meta
        this.compress = compress
        const hashHexCharacters = Math.ceil(meta.hash_bits / 4)
        this.hash_hex_characters = hashHexCharacters
        this.tracks = tracks
        return { hashHexCharacters, compress, tracks }
      }
      throw new Error('Error parsing meta.json')

      // const { compress } = meta
      // this.compress = compress
      // const hashHexCharacters = Math.ceil(meta.hash_bits / 4)
      // this.hash_hex_characters = hashHexCharacters
    } catch (err) {
      // throw Error(err)
      console.warn(`Error: ${err}`)
    }
    return {}
  }

  async getHashHexCharacters() {
    if (this.hash_hex_characters) {
      return this.hash_hex_characters
    }
    const meta = await this.readMeta()
    return meta.hashHexCharacters
  }

  async getCompress() {
    if (this.compress) {
      return this.compress
    }
    const meta = await this.readMeta()
    return meta.compress
  }

  async getTrackNames() {
    if (this.tracks) {
      return this.tracks
    }
    const meta = await this.readMeta()
    return meta.tracks
  }

  /**
   * Returns contents of a bucket given a key
   * @param key - string
   */
  async get(key: string) {
    const bucket: Record<string, any> = await this.getBucket(key)
    return bucket[key]
  }

  /**
   * Returns a bucket given a key
   * @param key - string
   */
  async getBucket(key: string) {
    const bucketIdent = this.hash(key)
    try {
      const hexToDirPath = await this.hexToDirPath(bucketIdent)
      const value = await this.loadFile(hexToDirPath)
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
    const response = await fetch(`${this.url}${id}`, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
    try {
      const data = await response.json()
      return data
    } catch (err) {
      // handle error
      // throw Error(err)
      console.warn(`Error: ${err}`)
    }
    return {}
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
      hex = hex.substr(8 - hashHexCharacters)
      const dirpath = []
      for (let i = 0; i < hex.length; i += 3) {
        dirpath.push(hex.substring(i, i + 3))
      }
      return `${dirpath.join('/')}.json${compress ? 'z' : ''}`
    }
    return ''
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
