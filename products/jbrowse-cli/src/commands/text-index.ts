import { flags } from '@oclif/command'
import JBrowseCommand, { Config } from '../base'
import { ReadStream, createReadStream, promises } from 'fs'
import { Transform, PassThrough } from 'stream'
import gff from '@gmod/gff'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import {
  FollowResponse,
  http as httpFR,
  https as httpsFR,
} from 'follow-redirects'
import { compress } from 'lzutf8'
import { createGunzip, Gunzip } from 'zlib'
import { IncomingMessage } from 'http'
import path from 'path'

export default class TextIndex extends JBrowseCommand {
  // @ts-ignore
  target: string

  static description = 'Make a text-indexing file for any given track(s).'

  static examples = [
    '$ jbrowse text-index',
    '$ jbrowse text-index --tracks=track1,track2,track3',
    '$ jbrowse text-index --individual --tracks=my_track_id',
    '$ jbrowse text-index ... --location=out_location_directory',
    '$ jbrowse text-index ... --target=path_to_configuration_file',
    '$ jbrowse text-index ... --out=path_to_configuration_file',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    tracks: flags.string({
      description: `Specify the tracks to index, formatted as comma separated trackIds`,
    }),
    individual: flags.boolean({
      description: `Only make a single-track text index for the given track`,
    }),
    location: flags.string({
      description: `Establish a location for the output files`,
    }),
    target: flags.string({
      description:
        'Path to config file in JB2 installation directory to read from.',
    }),
    out: flags.string({
      description: 'Synonym for target',
    }),
  }

  // Called when running the terminal command. Parses the given flags
  // and tracks associated. Gets their information and sends it to the
  // appropriate file parser to be indexed
  async run() {
    const { flags: runFlags } = this.parse(TextIndex)

    const configPath: string = path.join(__dirname, '..', '..', 'config.json')
    const output = runFlags?.target || runFlags?.out || configPath || '.'
    const isDir = (await promises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output
    let fileDirectory: string = path.join(__dirname)

    if (runFlags.individual) {
      if (runFlags.tracks) {
        if (runFlags.location) {
          fileDirectory = runFlags.location
        }

        const trackIds: Array<string> = runFlags.tracks?.split(',')
        if (trackIds.length > 1) {
          this.error(
            'Error, --individual flag only allows one track to be indexed',
          )
        } else {
          const indexConfig = await this.getIndexingConfigurations(
            trackIds,
            this.target,
          )
          const indexAttributes = indexConfig[0]?.attributes || []
          const uri =
            indexConfig[0].indexingConfiguration?.gffLocation.uri || ''

          await this.indexDriver(
            uri,
            false,
            indexAttributes,
            fileDirectory,
          ).catch(err => this.error(err))
        }
      } else {
        this.error('Error, please specify a track to index.')
      }
    } else if (runFlags.tracks) {
      if (runFlags.location) {
        fileDirectory = runFlags.location
      }

      const trackIds: Array<string> = runFlags.tracks.split(',')
      const uris: Array<string> = []
      const indexConfig = await this.getIndexingConfigurations(
        trackIds,
        this.target,
      )

      for (const x in indexConfig) {
        uris.push(indexConfig[x]?.indexingConfiguration?.gffLocation.uri || '')
      }
      const indexAttributes = indexConfig[0]?.attributes || []

      await this.indexDriver(
        uris,
        false,
        indexAttributes,
        fileDirectory,
      ).catch(err => this.error(err))
    } else {
      // aggregate index all in the config so far
      if (runFlags.location) {
        fileDirectory = runFlags.location
      }

      const uris: Array<string> = []
      const indexConfig = await this.getIndexingConfigurations(
        [],
        this.target,
        true,
      )
      const indexAttributes = indexConfig[0]?.attributes || []

      for (const x in indexConfig) {
        if (indexConfig[x]?.indexingConfiguration?.gffLocation.uri) {
          uris.push(
            indexConfig[x]?.indexingConfiguration?.gffLocation.uri || '',
          )
        } else {
          continue
        }
      }

      await this.indexDriver(
        uris,
        false,
        indexAttributes,
        fileDirectory,
      ).catch(err => this.error(err))
    }
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
  async indexDriver(
    uris: string | Array<string>,
    isTest: boolean,
    attributesArr: Array<string>,
    outLocation: string,
  ) {
    // For loop for each uri in the uri array
    if (typeof uris === 'string') {
      uris = [uris]
    } // turn uris string into an array of one string

    let aggregateStream = new PassThrough()
    let numStreamsFlowing = uris.length

    //  For each uri, we parse the file and add it to aggregateStream.
    for (const uri of uris) {
      // Generate transform function parses an @gmod/gff stream.
      const gffTranform = new Transform({
        objectMode: true,
        transform: (chunk, _encoding, done) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          chunk.forEach((record: any) => {
            this.recurseFeatures(record, gff3Stream, attributesArr)
            done()
          })
        },
      })

      let gff3Stream: ReadStream | Transform
      // If it is a URL, we want to await the http request.
      if (this.isURL(uri)) {
        gff3Stream = await this.handleGff3Url(uri, uri.includes('.gz'))
        gff3Stream = gff3Stream.pipe(gffTranform)
      }
      // If it is local, there is no need to await.
      else {
        gff3Stream = this.handleLocalGff3(uri, uri.includes('.gz'))
        gff3Stream = gff3Stream.pipe(gffTranform)
      }

      // Add gff3Stream to aggregateStream, and DO NOT send 'end' event on completion,
      // otherwise this would stop all streams from piping to the aggregate before completion.
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

    return this.runIxIxx(aggregateStream, isTest, outLocation)
  }

  // Take in the local file path, check if the it is gzipped or not,
  // then passes it into the correct file handler.
  // Returns a @gmod/gff stream.
  handleLocalGff3(gff3LocalIn: string, isGZ: boolean) {
    const gff3ReadStream: ReadStream = createReadStream(gff3LocalIn)
    if (!isGZ) {
      return this.parseGff3Stream(gff3ReadStream)
    } else {
      return this.handleLocalGzip(gff3ReadStream)
    }
  }

  // Method for handing off the parsing of a gff3 file URL.
  // Calls the proper parser depending on if it is gzipped or not.
  // Returns a @gmod/gff stream.
  async handleGff3Url(urlIn: string, isGZ: boolean): Promise<ReadStream> {
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

    const promise = new Promise<ReadStream>((resolve, reject) => {
      if (newUrl.protocol === 'https:') {
        httpsFR
          .get(urlIn, (response: IncomingMessage & FollowResponse) => {
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
      } else {
        httpFR
          .get(urlIn, (response: IncomingMessage & FollowResponse) => {
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
      }
    }) // End of promise

    return promise
  }

  // Grab the remote file from urlIn, then unzip it before
  // piping into parseGff3Stream for parsing.
  // Returns a promise for the resulting @gmod/gff stream.
  handleGff3UrlWithGz(urlIn: string) {
    const unzip = createGunzip()
    const newUrl = new URL(urlIn)

    const promise = new Promise<ReadStream>((resolve, reject) => {
      if (newUrl.protocol === 'https:') {
        httpsFR
          .get(urlIn, (response: IncomingMessage & FollowResponse) => {
            const parseStream = this.parseGff3Stream(response.pipe(unzip))
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
      } else {
        httpFR
          .get(urlIn, (response: IncomingMessage & FollowResponse) => {
            const parseStream = this.parseGff3Stream(response.pipe(unzip))
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
      }
    }) // End of promise
    return promise
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

  // Handles local gZipped files by unzipping them
  // then passing them into the parseGff3()
  // Returns a @gmod/gff stream.
  handleLocalGzip(file: ReadStream) {
    const unzip = createGunzip()
    const gZipRead = file.pipe(unzip)
    return this.parseGff3Stream(gZipRead)
  }

  // Function that takes in a gff3 readstream and parses through
  // it and retrieves the needed attributes and information.
  // Returns a @gmod/gff stream.
  parseGff3Stream(
    gff3In: ReadStream | (IncomingMessage & FollowResponse) | Gunzip,
  ) {
    const gff3Stream: ReadStream = gff3In.pipe(
      gff.parseStream({ parseSequences: false }),
    )

    return gff3Stream
  }

  // Recursively goes through every record in the gff3 file and gets
  // the desired attributes in the form of a JSON object. It is then
  // pushed to gff3Stream in proper indexing format.
  async recurseFeatures(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    record: any,
    gff3Stream: ReadStream | Transform,
    attributesArr: Array<string>,
  ) {
    // check if the attributes array is undefined
    // breaks out of loop if it is (end of recursion)
    if (attributesArr) {
      // goes through the attributes array and checks
      // if the record contains the attribute that the
      // user wants to search by. If it contains it,
      // it adds it to the record object and attributes
      // string

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getAndPushRecord = (subRecord: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recordObj: any = {}
        let attrString = ''

        for (const attr of attributesArr) {
          // Check to see if the attr exists for the record
          if (subRecord[attr]) {
            recordObj[attr] = subRecord[attr]
            attrString += ' ' + recordObj[attr]
          } else if (subRecord.attributes && subRecord.attributes[attr]) {
            // Name and ID are in the attributes object, so check there too
            recordObj[attr] = subRecord.attributes[attr]
            attrString += ' ' + recordObj[attr]
          }
        }

        // encodes the record object so that it can be used by ixIxx
        // appends the attributes that we are indexing by to the end
        // of the string before pushing to ixIxx
        const buff = compress(Buffer.from(JSON.stringify(recordObj)), {
          outputEncoding: 'Base64',
        })

        let str: string = buff.toString()
        str += attrString + '\n'

        gff3Stream.push(str)
      }

      if (Array.isArray(record)) {
        for (const r of record) {
          getAndPushRecord(r)
        }
      } else {
        getAndPushRecord(record)
      }
    } else {
      return
    }

    // recurses through each record to get child features and
    // parses their attributes as well.

    if (record.child_features || record[0].child_features) {
      if (Array.isArray(record)) {
        for (const r of record) {
          for (let i = 0; i < record[0].child_features.length; i++) {
            this.recurseFeatures(r.child_features[i], gff3Stream, attributesArr)
          }
        }
      } else {
        for (let i = 0; i < record['child_features'].length; i++) {
          this.recurseFeatures(
            record.child_features[i],
            gff3Stream,
            attributesArr,
          )
        }
      }
    }
  }

  // Given a readStream of data, indexes the stream into .ix and .ixx files using ixIxx.
  // The ixIxx executable is required on the system path for users, however tests use a local copy.
  // Returns a promise around ixIxx completing (or erroring).
  runIxIxx(
    readStream: ReadStream | PassThrough,
    isTest: boolean,
    outLocation: string,
  ) {
    const ixFileName = 'out.ix'
    const ixxFileName = 'out.ixx'

    let ixProcess: ChildProcessWithoutNullStreams

    if (isTest) {
      // If this is a test, output to test/data/ directory, and use the local version of ixIxx.
      ixProcess = spawn(
        'cat | ./products/jbrowse-cli/test/ixIxx /dev/stdin',
        [
          './products/jbrowse-cli/test/data/out.ix',
          './products/jbrowse-cli/test/data/out.ixx',
        ],
        { shell: true },
      )
    }
    // Otherwise require user to have ixIxx in their system path.
    else {
      ixProcess = spawn(
        'cat | ixIxx /dev/stdin',
        [outLocation + '/' + ixFileName, outLocation + '/' + ixxFileName],
        {
          shell: true,
        },
      )
    }

    // Pass the readStream as stdin into ixProcess.
    readStream.pipe(ixProcess.stdin).on('error', e => {
      this.error(`Error writing data to ixIxx. ${e}`)
    })

    // End the ixProcess stdin when the stream is done.
    readStream.on('end', () => {
      ixProcess.stdin.end()
    })

    ixProcess.stdout.on('data', data => {
      this.log(`Output from ixIxx: ${data}`)
    })

    const promise = new Promise((resolve, reject) => {
      ixProcess.on('close', code => {
        if (code === 0) {
          resolve('Success!')
          // Code should = 0 for success
          this.log(
            `Indexing done! Check ${ixFileName} and ${ixxFileName} files for output.`,
          )
          return code
        } else {
          reject(`ixIxx exited with code: ${code}`)
          return code
        }
      })

      // Hook up the reject from promise on error
      ixProcess.stderr.on('data', data => {
        reject(`Error with ixIxx: ${data}`)
      })
    }).catch(errorData => {
      // Catch any promise rejection errors with running ixIxx here.

      if (errorData.includes('not found')) {
        this.error('ixIxx was not found in your system.')
      } else {
        this.error(errorData)
      }
    })

    return promise
  }

  // Function that takes in an array of tracks and returns an array of
  // identifiers stating what will be indexed.
  // Params:
  //  trackIds: array of string ids for tracks to index
  //  runFlags: specify if there is a target ouput location for the indexing
  async getIndexingConfigurations(
    trackIds: Array<string>,
    configPath: string,
    aggregate = false,
  ) {
    // are we planning to have target and output flags on this command?
    try {
      const isFile = (await promises.lstat(configPath)).isFile()
      const config: Config = await this.readJsonFile(configPath)
      if (!config.tracks) {
        this.error(
          'Error, no tracks found in config.json. Please add a track before indexing.',
        )
      }
      let trackIdsToIndex: Array<string> = []
      if (aggregate) {
        trackIdsToIndex = config.tracks.map(track => track.trackId)
      } else {
        trackIdsToIndex = trackIds
      }
      const configurations = trackIdsToIndex.map(trackId => {
        const currentTrack = config.tracks?.find(
          track => trackId === track.trackId,
        )
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
      return configurations
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.error('config.json not found in this directory')
      }
      this.error(`Error: ${e}`)
    }
    return []
  }
}
