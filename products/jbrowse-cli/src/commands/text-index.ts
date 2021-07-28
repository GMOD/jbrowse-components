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
    const defaultAttributes = ['Name', 'description', 'Note', 'ID']
    const { flags } = this.parse(TextIndex)
    const outdir = flags.target || flags.out || '.'
    const isDir = (await fs.promises.lstat(outdir)).isDirectory()
    const target = isDir ? `${outdir}/config.json` : outdir

    const configDirectory = path.dirname(target)
    const config: Config = JSON.parse(fs.readFileSync(target, 'utf8'))
    const assembliesToIndex =
      flags.assemblies?.split(',') || config.assemblies?.map(a => a.name) || []
    const adapters = config.aggregateTextSearchAdapters || []
    for (const asm of assembliesToIndex) {
      const config = await this.getConfig(target, asm, flags.tracks?.split(','))

      this.log('Indexing assembly ' + asm + '...')

      await this.indexDriver(config, defaultAttributes, configDirectory, asm)

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

    fs.writeFileSync(
      target,
      JSON.stringify(
        { ...config, aggregateTextSearchAdapters: adapters },
        null,
        2,
      ),
    )
    this.log('Finished!')
  }

  // Diagram of function call flow:

  //
  //                                      ------> handleGff3UrlWithGz()---\
  //                                    /                                  parseGff3Stream()
  //                                  / --------> handleGff3UrlNoGz()-----/                 \
  //                                /                                                        \
  //               -----> handleURL()                                                         \
  //              |                                                                            \
  // indexDriver()                                                                          returns ----> indexDriver() -------> runIxIxx --------> output .ix and .ixx files
  //              \                                                                            /               ⇆
  //               -----> handleLocalGff3()                                                   /         recurseFeatures()
  //                                      \                                                 /
  //                                       \ -----> parseLocalGZip() ---\                 /
  //                                        \                            parseGff3Stream()
  //                                         --------------------------/
  //

  // This function takes a list of uris, as well as which attributes to index,
  // and indexes them all into one aggregate index.
  async indexDriver(
    configs: Track[],
    attributes: string[],
    outLocation: string,
    assemblyName: string,
  ) {
    if (!configs.length) {
      return
    }
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
              this.recurseFeatures(record, gff3Stream, attributes, trackId)
            })
            done()
          },
        })
        // Generate transform function parses an @gmod/gff stream.

        const gff3Stream = (
          await (this.isURL(uri)
            ? this.handleGff3Url(uri, uri.includes('.gz'))
            : this.handleLocalGff3(
                path.join(outLocation, uri),
                uri.includes('.gz'),
              ))
        ).pipe(gffTransform)

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
    return this.runIxIxx(aggregateStream, path.join('trix'), assemblyName)
  }

  // Take in the local file path, check if the it is gzipped or not, then
  // passes it into the correct file handler.  Returns a @gmod/gff stream.
  handleLocalGff3(gff3LocalIn: string, isGZ: boolean) {
    const gff3ReadStream = fs.createReadStream(gff3LocalIn)
    if (!isGZ) {
      return this.parseGff3Stream(gff3ReadStream)
    } else {
      return this.parseGff3Stream(gff3ReadStream.pipe(createGunzip()))
    }
  }

  // Method for handing off the parsing of a gff3 file URL.
  // Calls the proper parser depending on if it is gzipped or not.
  // Returns a @gmod/gff stream.
  async handleGff3Url(urlIn: string, isGZ: boolean) {
    return !isGZ
      ? this.handleGff3UrlNoGz(urlIn)
      : this.handleGff3UrlWithGz(urlIn)
  }

  // Grabs the remote file from urlIn, then pipe it directly to parseGff3Stream()
  // for parsing and indexing.
  // Returns a promise for the resulting @gmod/gff stream.
  handleGff3UrlNoGz(urlIn: string) {
    const newUrl = new URL(urlIn)

    return new Promise<Readable>((resolve, reject) => {
      ;(newUrl.protocol === 'https:' ? httpsFR : httpFR)
        .get(urlIn, response => {
          const parseStream = this.parseGff3Stream(response)
          resolve(parseStream)
        })
        .on('error', (e: NodeJS.ErrnoException) => {
          reject('fail')
          if (e.code === 'ENOTFOUND') {
            this.error('Bad file url')
          } else {
            this.error('Other error: ', e)
          }
        })
    })
  }

  // Grab the remote file from urlIn, then unzip it before piping into
  // parseGff3Stream for parsing.  Returns a promise for the resulting
  // @gmod/gff stream.
  handleGff3UrlWithGz(urlIn: string) {
    const unzip = createGunzip()
    const newUrl = new URL(urlIn)

    return new Promise<Readable>((resolve, reject) => {
      ;(newUrl.protocol === 'https:' ? httpsFR : httpFR)
        .get(urlIn, response => {
          resolve(this.parseGff3Stream(response.pipe(unzip)))
        })
        .on('error', (e: NodeJS.ErrnoException) => {
          reject('fail')
          if (e.code === 'ENOTFOUND') {
            this.error('Bad file url')
          } else {
            this.error('Other error: ', e)
          }
        })
    })
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

  // Function that takes in a gff3 readstream and parses through it and
  // retrieves the needed attributes and information. Returns a @gmod/gff
  // stream.
  parseGff3Stream(gff3In: Readable): Readable {
    return gff3In.pipe(gff.parseStream({ parseSequences: false }))
  }

  // Recursively goes through every record in the gff3 file and gets the
  // desired attributes in the form of a JSON object. It is then pushed to
  // gff3Stream in proper indexing format.
  //
  recurseFeatures(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    record: any,
    gff3Stream: Readable,
    attributes: string[],
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
      const locStr = `${subRecord['seq_id']};${subRecord['start']}..${subRecord['end']}`
      const RecordValues: Array<string> = []
      const RecordAttributes: Array<string> = []

      RecordAttributes.push('locstring', 'TrackID')
      RecordValues.push(locStr, trackID)

      for (const x of attributes) {
        RecordAttributes.push(x)
      }

      fs.writeFileSync(
        path.join(__dirname, '..', '..', 'trix', 'meta.json'),
        JSON.stringify({ indexingAttributes: RecordAttributes }, null, 2),
      )

      for (const attr of attributes) {
        if (subRecord[attr]) {
          RecordValues.push(subRecord[attr])
          RecordAttributes.push(attr)
        } else if (subRecord.attributes?.[attr]) {
          RecordValues.push(subRecord.attributes[attr])
          RecordAttributes.push(attr)
        } else {
          RecordValues.push('attributePlaceholder')
        }
      }
      // create a meta object that has types field
      // compare every array to the existing types field
      // if it doesnt exist then append add it
      // push the object to meta.json
      if (RecordAttributes.length > 2) {
        const uniqAttrs = [...new Set(RecordValues)]

        const buff = Buffer.from(JSON.stringify(RecordValues)).toString(
          'base64',
        )
        gff3Stream.push(`${buff} ${uniqAttrs.join(' ')}\n`)
      }
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
              attributes,
              trackID,
            )
          }
        }
      } else {
        for (let i = 0; i < record['child_features'].length; i++) {
          this.recurseFeatures(
            record.child_features[i],
            gff3Stream,
            attributes,
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
    const ixFilename = path.join(outLocation, `${assembly}.ix`)
    const ixxFilename = path.join(outLocation, `${assembly}.ixx`)

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
