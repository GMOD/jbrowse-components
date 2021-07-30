import path from 'path'
import { SingleBar, Presets } from 'cli-progress'
import readline from 'readline'
import fs from 'fs'
import { flags } from '@oclif/command'
import { Readable } from 'stream'
import { ixIxxStream } from 'ixixx'
import { IncomingMessage } from 'http'
import { http, https, FollowResponse } from 'follow-redirects'
import { createGunzip } from 'zlib'
import JBrowseCommand, { Track, Config } from '../base'

export default class TextIndex extends JBrowseCommand {
  static description = 'Make a text-indexing file for any given track(s).'

  static examples = [
    "# indexes all tracks that it can find in the current directory's config.json",
    '$ jbrowse text-index',
    "# indexes specific trackIds that it can find in the current directory's config.json",
    '$ jbrowse text-index --tracks=track1,track2,track3',
    "# indexes all tracks in a directory's config.json or in a specific config file",
    '$ jbrowse text-index --out /path/to/jb2/',
    '$ jbrowse text-index --out /path/to/jb2/some_alt_config.json',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    tracks: flags.string({
      description: `Specific tracks to index, formatted as comma separated trackIds. If unspecified, indexes all available tracks`,
    }),
    target: flags.string({
      description:
        'Path to config file in JB2 installation directory to read from.',
    }),
    out: flags.string({
      description: 'Synonym for target',
    }),

    attributes: flags.string({
      description: 'Comma separated list of attributes to index',
      default: 'Name,ID',
    }),
    assemblies: flags.string({
      char: 'a',
      description:
        'Specify the assembl(ies) to create an index for. If unspecified, creates an index for each assembly in the config',
    }),
    force: flags.boolean({
      default: false,
      description: 'Overwrite previously existing indexes',
    }),
    quiet: flags.boolean({
      char: 'q',
      default: false,
      description: 'Hide the progress bars',
    }),
  }

  // Called when running the terminal command. Parses the given flags and
  // tracks associated. Gets their information and sends it to the appropriate
  // file parser to be indexed
  async run() {
    const {
      flags: { out, target, tracks, assemblies, attributes, quiet, force },
    } = this.parse(TextIndex)
    const outFlag = target || out || '.'
    const confFile = fs.lstatSync(outFlag).isDirectory()
      ? path.join(outFlag, 'config.json')
      : outFlag
    const dir = path.dirname(confFile)

    const config: Config = JSON.parse(fs.readFileSync(confFile, 'utf8'))
    const assembliesToIndex =
      assemblies?.split(',') || config.assemblies?.map(a => a.name) || []
    const adapters = config.aggregateTextSearchAdapters || []

    const trixDir = path.join(dir, 'trix')
    if (!fs.existsSync(trixDir)) {
      fs.mkdirSync(trixDir)
    }

    for (const asm of assembliesToIndex) {
      const config = await this.getConfig(confFile, asm, tracks?.split(','))

      this.log('Indexing assembly ' + asm + '...')

      if (config.length) {
        const id = asm + '-index'
        const adapterAlreadyFound = adapters.find(
          x => x.textSearchAdapterId === id,
        )
        if (adapterAlreadyFound && !force) {
          this.log(
            `Note: ${asm} has already been indexed with this configuration, use --force to overwrite this assembly. Skipping for now`,
          )
        }

        await this.indexDriver(config, attributes.split(','), dir, asm, quiet)

        // Checks through list of configs and checks the hash values
        // if it already exists it updates the entry and increments the
        // check varible. If the check variable is equal to 0 that means
        // the entry does not exist and creates one.
        if (!adapterAlreadyFound) {
          adapters.push({
            type: 'TrixTextSearchAdapter',
            textSearchAdapterId: id,
            ixFilePath: {
              uri: `trix/${asm}.ix`,
            },
            ixxFilePath: {
              uri: `trix/${asm}.ixx`,
            },
            metaFilePath: {
              uri: `trix/meta.json`,
            },
            assemblies: [asm],
          })
        }
      }
    }

    fs.writeFileSync(
      confFile,
      JSON.stringify(
        { ...config, aggregateTextSearchAdapters: adapters },
        null,
        2,
      ),
    )
    this.log('Finished!')
  }

  // This function takes a list of tracks, as well as which attributes to
  // index, and indexes them all into one aggregate index.
  async indexDriver(
    configs: Track[],
    attributes: string[],
    out: string,
    assemblyName: string,
    quiet: boolean,
  ) {
    const readable = Readable.from(
      this.indexFile(configs, attributes, out, quiet),
    )
    return this.runIxIxx(readable, out, assemblyName)
  }

  async *indexFile(
    configs: Track[],
    attributes: string[],
    outLocation: string,
    quiet: boolean,
  ) {
    for (const config of configs) {
      const {
        adapter: { type },
      } = config

      if (type === 'Gff3TabixAdapter') {
        yield* this.indexGff3(config, attributes, outLocation, quiet)
      }
    }
  }

  async *indexGff3(
    config: Track,
    attributes: string[],
    outLocation: string,
    quiet: boolean,
  ) {
    const {
      adapter: {
        gffGzLocation: { uri },
      },
      trackId,
    } = config

    // progress bar code was aided by blog post at
    // https://webomnizz.com/download-a-file-with-progressbar-using-node-js/
    const progressBar = new SingleBar(
      {
        format: '{bar} ' + trackId + ' {percentage}% | ETA: {eta}s',
      },
      Presets.shades_classic,
    )

    let fileDataStream
    let totalBytes = 0
    let receivedBytes = 0
    if (this.isURL(uri)) {
      fileDataStream = await this.createRemoteStream(uri)
      totalBytes = +(fileDataStream.headers['content-length'] || 0)
    } else {
      const filename = path.join(outLocation, uri)
      totalBytes = fs.statSync(filename).size
      fileDataStream = fs.createReadStream(filename)
    }

    if (!quiet) {
      progressBar.start(totalBytes, 0)
    }

    fileDataStream.on('data', chunk => {
      receivedBytes += chunk.length
      progressBar.update(receivedBytes)
    })

    const gzStream = uri.endsWith('.gz')
      ? fileDataStream.pipe(createGunzip())
      : fileDataStream

    const rl = readline.createInterface({
      input: gzStream,
    })

    for await (const line of rl) {
      if (line.startsWith('#')) {
        continue
      } else if (line.startsWith('>')) {
        break
      }

      const [seq_id, , type, start, end, , , , col9] = line.split('\t')
      const locStr = `${seq_id}:${start}..${end}`

      if (type !== 'exon' && type !== 'CDS') {
        const col9attrs = col9.split(';')
        const name = col9attrs
          .find(f => f.startsWith('Name'))
          ?.split('=')[1]
          .trim()
        const id = col9attrs
          .find(f => f.startsWith('ID'))
          ?.split('=')[1]
          .trim()
        const attrs = attributes.map(attr =>
          col9attrs
            .find(f => f.startsWith(attr))
            ?.split('=')[1]
            .trim(),
        )
        if (name || id) {
          const record = JSON.stringify([locStr, trackId, name, id])
          const buff = Buffer.from(record).toString('base64')
          yield `${buff} ${[...new Set(attrs)].join(' ')}\n`
        }
      }
    }

    progressBar.stop()
  }

  // Method for handing off the parsing of a gff3 file URL.
  // Calls the proper parser depending on if it is gzipped or not.
  // Returns a @gmod/gff stream.
  async createRemoteStream(urlIn: string) {
    const newUrl = new URL(urlIn)
    const fetcher = newUrl.protocol === 'https:' ? https : http

    return new Promise<IncomingMessage & FollowResponse>((resolve, reject) =>
      fetcher.get(urlIn, resolve).on('error', reject),
    )
  }

  // Checks if the passed in string is a valid URL.
  // Returns a boolean.
  isURL(FileName: string) {
    let url

    try {
      url = new URL(FileName)
    } catch (_) {
      return false
    }

    return url.protocol === 'http:' || url.protocol === 'https:'
  }

  // Given a readStream of data, indexes the stream into .ix and .ixx files
  // using ixIxx.  The ixIxx executable is required on the system path for
  // users, however tests use a local copy.  Returns a promise around ixIxx
  // completing (or erroring).
  runIxIxx(readStream: Readable, outLocation: string, assembly: string) {
    const ixFilename = path.join(outLocation, 'trix', `${assembly}.ix`)
    const ixxFilename = path.join(outLocation, 'trix', `${assembly}.ixx`)

    return ixIxxStream(readStream, ixFilename, ixxFilename)
  }

  // Function that takes in an array of tracks and returns an array of
  // identifiers stating what will be indexed
  async getConfig(
    configPath: string,
    assemblyName: string,
    trackIds?: string[],
  ) {
    const { tracks } = (await this.readJsonFile(configPath)) as Config
    if (!tracks) {
      throw new Error(
        'No tracks found in config.json. Please add a track before indexing.',
      )
    }
    const trackIdsToIndex = trackIds || tracks.map(track => track.trackId)

    return trackIdsToIndex
      .map(trackId => {
        const currentTrack = tracks.find(t => trackId === t.trackId)
        if (!currentTrack) {
          throw new Error(
            `Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`,
          )
        }
        return currentTrack
      })
      .filter(track => track.assemblyNames.includes(assemblyName))
      .filter(track => track.adapter.type === 'Gff3TabixAdapter')
  }
}
