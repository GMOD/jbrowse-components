import path from 'path'
import fs from 'fs'
import gff from '@gmod/gff'
import { flags } from '@oclif/command'
import { Readable } from 'stream'
import { ixIxxStream } from 'ixixx'
import { Transform, PassThrough } from 'stream'
import { http as httpFR, https as httpsFR } from 'follow-redirects'
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
  }

  // Called when running the terminal command. Parses the given flags and
  // tracks associated. Gets their information and sends it to the appropriate
  // file parser to be indexed
  async run() {
    const { flags } = this.parse(TextIndex)
    const { out, target, tracks, assemblies, attributes } = flags
    const outFlag = target || out || '.'
    const isDir = fs.lstatSync(outFlag).isDirectory()
    const confFile = isDir ? `${outFlag}/config.json` : outFlag
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
        await this.indexDriver(config, attributes.split(','), dir, asm)

        adapters.push({
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: 'TrixAdapter',
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
    outLocation: string,
    assemblyName: string,
  ) {
    let aggregateStream = new PassThrough()
    let numStreamsFlowing = configs.length

    //  For each uri, we parse the file and add it to aggregateStream.
    for (const config of configs) {
      const {
        trackId,
        adapter: {
          type,
          gffGzLocation: { uri },
        },
      } = config

      if (type === 'Gff3TabixAdapter') {
        const gffTransform = new Transform({
          objectMode: true,
          transform: (chunk, _encoding, done) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chunk.forEach((record: any) => {
              this.recurseFeatures(
                record,
                gff3Stream,
                attributes,
                trackId,
                outLocation,
              )
            })
            done()
          },
        })

        const fileDataStream = await (this.isURL(uri)
          ? this.createRemoteStream(uri)
          : fs.createReadStream(path.join(outLocation, uri)))

        const gzStream = uri.endsWith('.gz')
          ? fileDataStream.pipe(createGunzip())
          : fileDataStream

        const gff3Stream = gzStream
          .pipe(gff.parseStream({ parseSequences: false }))
          .pipe(gffTransform)

        // Add gff3Stream to aggregateStream, and DO NOT send 'end' event on
        // completion, otherwise this would stop all streams from piping to the
        // aggregate before completion.
        aggregateStream = gff3Stream.pipe(aggregateStream, { end: false })

        // If a stream ends we have two options:
        //  1) it is the last stream, so end the aggregate stream.
        //  2) it is not the last stream, so add a '\n' to separate streams for the indexer.

        // eslint-disable-next-line no-loop-func
        gff3Stream.once('end', () => {
          if (--numStreamsFlowing === 0) {
            aggregateStream.end()
          } else {
            aggregateStream.push('\n')
          }
        })
      }
    }
    return this.runIxIxx(aggregateStream, outLocation, assemblyName)
  }

  // Method for handing off the parsing of a gff3 file URL.
  // Calls the proper parser depending on if it is gzipped or not.
  // Returns a @gmod/gff stream.
  async createRemoteStream(urlIn: string) {
    const newUrl = new URL(urlIn)
    const fetcher = newUrl.protocol === 'https:' ? httpsFR : httpFR

    return new Promise<Readable>((resolve, reject) =>
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

  // Recursively goes through every record in the gff3 file and gets the
  // desired attributes in the form of a JSON object. It is then pushed to
  // gff3Stream in proper indexing format.
  recurseFeatures(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    record: any,
    gff3Stream: Readable,
    indexAttrs: string[],
    trackID: string,
  ) {
    // goes through the attributes array and checks if the record contains the
    // attribute that the user wants to search by. If it contains it, it adds
    // it to the record object and attributes string

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getAndPushRecord = (subRecord: any) => {
      if (!subRecord) {
        return
      }
      const { seq_id, start, end, attributes } = subRecord
      const locStr = `${seq_id}:${start}..${end}`
      const name = attributes.Name?.[0] || attributes.ID?.[0]

      const entry = []
      for (const attr of indexAttrs) {
        const val = subRecord[attr] || attributes?.[attr]
        if (val) {
          entry.push(...val)
        }
      }

      // create a meta object that has types field compare every array to the
      // existing types field if it doesnt exist then append add it push the
      // object to meta.json
      const buff = Buffer.from(JSON.stringify([locStr, trackID, name]))
      gff3Stream.push(
        `${buff.toString('base64')} ${[...new Set(entry)].join(' ')}\n`,
      )
    }

    if (Array.isArray(record)) {
      record.forEach(r => getAndPushRecord(r))
    } else {
      getAndPushRecord(record)
    }

    // recurses through each record to get child features and parses their
    // attributes as well.
    if (record?.child_features || record?.[0].child_features) {
      if (Array.isArray(record)) {
        for (const r of record) {
          for (let i = 0; i < record[0].child_features.length; i++) {
            this.recurseFeatures(
              r.child_features[i],
              gff3Stream,
              indexAttrs,
              trackID,
            )
          }
        }
      } else {
        for (let i = 0; i < record['child_features'].length; i++) {
          this.recurseFeatures(
            record.child_features[i],
            gff3Stream,
            indexAttrs,
            trackID,
          )
        }
      }
    }
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
