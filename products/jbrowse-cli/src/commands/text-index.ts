import { flags } from '@oclif/command'
import { Readable } from 'stream'
import JBrowseCommand, { Config } from '../base'
import { ixIxxStream } from 'ixixx'
import fs from 'fs'
import { Transform, PassThrough } from 'stream'
import gff from '@gmod/gff'
import { http as httpFR, https as httpsFR } from 'follow-redirects'
import { createGunzip } from 'zlib'
import path from 'path'

export default class TextIndex extends JBrowseCommand {
  target = ''

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
      description: `Specify the tracks to index, formatted as comma separated trackIds`,
    }),
    target: flags.string({
      description:
        'Path to config file in JB2 installation directory to read from.',
    }),
    out: flags.string({
      description: 'Synonym for target',
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
    this.target = isDir ? `${outdir}/config.json` : outdir

    const configDirectory = path.dirname(this.target)
    const config = await this.getConfig(this.target, flags.tracks?.split(','))

    const uris = config
      .map(entry => entry?.indexingConfiguration?.gffLocation.uri)
      .filter((f): f is string => !!f)

    await this.indexDriver(uris, defaultAttributes, configDirectory)
    const json = JSON.parse(fs.readFileSync(this.target, 'utf8'))
    json.aggregateTextSearchAdapters = [
      {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'TrixAdapter',
        ixFilePath: {
          uri: 'out.ix',
        },
        ixxFilePath: {
          uri: 'out.ixx',
        },
        assemblies: json.assemblies.map((a: { name: string }) => a.name),
      },
    ]
    fs.writeFileSync(this.target, JSON.stringify(json, null, 2))
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
  // Returns a promise of the indexing child process completing.
  async indexDriver(uris: string[], attributes: string[], outLocation: string) {
    // For loop for each uri in the uri array
    if (typeof uris === 'string') {
      uris = [uris]
    } // turn uris string into an array of one string

    let aggregateStream = new PassThrough()
    let numStreamsFlowing = uris.length

    //  For each uri, we parse the file and add it to aggregateStream.
    for (const uri of uris) {
      // Generate transform function parses an @gmod/gff stream.
      const gffTransform = new Transform({
        objectMode: true,
        transform: (chunk, _encoding, done) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          chunk.forEach((record: any) => {
            this.recurseFeatures(record, gff3Stream, attributes)
            done()
          })
        },
      })

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

    return this.runIxIxx(aggregateStream, outLocation)
  }

  // Take in the local file path, check if the it is gzipped or not,
  // then passes it into the correct file handler.
  // Returns a @gmod/gff stream.
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
    if (!isGZ) {
      return this.handleGff3UrlNoGz(urlIn)
    } else {
      return this.handleGff3UrlWithGz(urlIn)
    }
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

  // Grab the remote file from urlIn, then unzip it before
  // piping into parseGff3Stream for parsing.
  // Returns a promise for the resulting @gmod/gff stream.
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

  // Function that takes in a gff3 readstream and parses through
  // it and retrieves the needed attributes and information.
  // Returns a @gmod/gff stream.
  parseGff3Stream(gff3In: Readable): Readable {
    return gff3In.pipe(gff.parseStream({ parseSequences: false }))
  }

  // Recursively goes through every record in the gff3 file and gets
  // the desired attributes in the form of a JSON object. It is then
  // pushed to gff3Stream in proper indexing format.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recurseFeatures(record: any, gff3Stream: Readable, attributes: string[]) {
    // goes through the attributes array and checks if the record contains the
    // attribute that the user wants to search by. If it contains it, it adds
    // it to the record object and attributes string

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getAndPushRecord = (subRecord: any) => {
      const locStr = `${subRecord['seq_id']};${subRecord['start']}..${subRecord['end']}`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recordObj: any = {
        locstring: `${locStr}`,
      }
      const attrs = []

      for (const attr of attributes) {
        if (subRecord[attr]) {
          recordObj[attr] = subRecord[attr]
          attrs.push(recordObj[attr].toString())
        } else if (subRecord.attributes?.[attr]) {
          recordObj[attr] = subRecord.attributes[attr]
          // using toString, even if this is an array, turns it into a single
          // element
          attrs.push(recordObj[attr].toString())
        }
      }

      if (attrs.length) {
        const buff = Buffer.from(JSON.stringify(recordObj)).toString('base64')
        const uniqAttrs = [...new Set(attrs)]
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
    if (record.child_features || record[0].child_features) {
      if (Array.isArray(record)) {
        for (const r of record) {
          for (let i = 0; i < record[0].child_features.length; i++) {
            this.recurseFeatures(r.child_features[i], gff3Stream, attributes)
          }
        }
      } else {
        for (let i = 0; i < record['child_features'].length; i++) {
          this.recurseFeatures(record.child_features[i], gff3Stream, attributes)
        }
      }
    }
  }

  // Given a readStream of data, indexes the stream into .ix and .ixx files
  // using ixIxx.  The ixIxx executable is required on the system path for
  // users, however tests use a local copy.  Returns a promise around ixIxx
  // completing (or erroring).
  runIxIxx(readStream: Readable, outLocation: string) {
    const ixFilename = path.join(outLocation, 'out.ix')
    const ixxFilename = path.join(outLocation, 'out.ixx')

    return ixIxxStream(readStream, ixFilename, ixxFilename)
  }

  // Function that takes in an array of tracks and returns an array of
  // identifiers stating what will be indexed.
  async getConfig(configPath: string, trackIds?: string[]) {
    const config: Config = await this.readJsonFile(configPath)
    if (!config.tracks) {
      this.error(
        'Error, no tracks found in config.json. Please add a track before indexing.',
      )
    }
    const trackIdsToIndex =
      trackIds || config.tracks.map(track => track.trackId)

    return trackIdsToIndex.map(trackId => {
      const currentTrack = config.tracks?.find(t => trackId === t.trackId)
      if (currentTrack) {
        const { adapter, textSearchIndexingAttributes } = currentTrack
        if (adapter.type === 'Gff3TabixAdapter') {
          return {
            trackId,
            indexingConfiguration: {
              indexingAdapter: 'GFF3',
              gzipped: true,
              gffLocation: adapter?.gffGzLocation,
            },
            attributes: textSearchIndexingAttributes,
          }
        }
      } else {
        this.error(
          `Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`,
        )
      }
      return {}
    })
  }
}
