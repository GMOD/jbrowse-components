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
import { compress } from 'shorter'
import { createGunzip, Gunzip } from 'zlib'
import { resolve } from 'path'
import { type } from 'os'
import { IncomingMessage } from 'http'
import { COPYFILE_FICLONE_FORCE } from 'constants'
import { getFileInfo } from 'prettier'

type trackConfig = {
  trackId: string
  indexingConfiguration: {
    indexingAdapter: string
    gzipped: boolean
    gffLocation: {
      uri: string
    }
  }
  attributes: Array<String>
}

export default class TextIndex extends JBrowseCommand {
  // @ts-ignore
  target: string

  static description = 'Make a single-track text index for the given track.'

  static examples = [
    '$ jbrowse text-index',
    '$ jbrowse text-index --tracks=track1,track2,track3',
    '$ jbrowse text-index --individual --tracks=my_track_id',
    '$ jbrowse text-index ... --location=my_file_path',
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
  }

  // Called when running the terminal command. Parses the given flags
  // and tracks associated. Gets their information and sends it to the
  // appropriate file parser to be indexed
  async run() {
    const { flags: runFlags } = this.parse(TextIndex)

    //NOTE: tests will always output to ./products/jbrowse-cli/test/data/
    //this is only valid for non-tests
    let fileDirectory: string = './test/data/'
    //FUTURE: command to set a default location

    if (runFlags.individual) {
      if (runFlags.tracks) {
        if (runFlags.location) {
          fileDirectory = runFlags.location
        }

        const trackIds: string = runFlags.tracks
        if (trackIds.split(',').length > 1) {
          this.error(
            'Error, --individual flag only allows one track to be indexed',
          )
        } else {
          const trackArr: Array<string> = [trackIds]
          const indexConfig = await this.getIndexingConfigurations(
            trackArr,
            null,
          )
          const indexAttributes: Array<string> = indexConfig[0].attributes

          const uri: string =
            indexConfig[0].indexingConfiguration.gffLocation.uri

          this.indexDriver(uri, false, indexAttributes, fileDirectory)
        }
      } else {
        this.error('Error, please specify a track to index.')
      }
    } else if (runFlags.tracks) {
      if (runFlags.location) {
        fileDirectory = runFlags.location
      }

      const trackIds: Array<string> = runFlags.tracks.split(',')

      const configurationsList = this.getIndexingConfigurations(
        trackIds,
        runFlags,
      )

      this.log(
        `TODO: implement aggregate text indexing for these tracks: ${trackIds}`,
      )
    } else {
      // aggregate index all in the config so far

      if (runFlags.location) {
        fileDirectory = runFlags.location
      }
      // For testing:
      // const uri: string = "./test/data/au9_scaffold_subset_sync.gff3"
      // const uri: string = 'https://github.com/GMOD/jbrowse-components/blob/cli_trix_indexer/test_data/volvox/volvox.sort.gff3.gz?raw=true'
      // const uri = 'https://raw.githubusercontent.com/GMOD/jbrowse/master/tests/data/au9_scaffold_subset_sync.gff3'
      // const uri = 'http://128.206.12.216/drupal/sites/bovinegenome.org/files/data/umd3.1/Ensembl_Mus_musculus.NCBIM37.67.pep.all_vs_UMD3.1.gff3.gz'

      // repeats_hg19
      // gff3tabix_genes

      const trackIds: Array<string> = ['gff3tabix_genes']
      const indexConfig = await this.getIndexingConfigurations(trackIds, null)
      // const indexAttributes: Array<string> = indexConfig[0].attributes;

      const testObjs = [
        {
          attributes: ['Name', 'ID', 'seq_id', 'start', 'end', 'type'],
          indexingConfiguration: {
            gffLocation: {
              uri: './test/data/au9_scaffold_subset_sync.gff3',
            },
            gzipped: true,
            indexingAdapter: 'GFF3',
          },
          trackId: 'gff3tabix_genes',
        },
      ]

      const indexAttributes: Array<string> = testObjs[0].attributes

      //const uri: string = indexConfig[0].indexingConfiguration.gffLocation.uri;
       const uri: string = testObjs[0].indexingConfiguration.gffLocation.uri
      //const uri = ['./test/data/volvox.sort.gff3.gz', 'http://128.206.12.216/drupal/sites/bovinegenome.org/files/data/umd3.1/RefSeq_UMD3.1.1_multitype_genes.gff3.gz', 'TAIR_GFF3_ssrs.gff']
      // const uri = 'Spliced_Junctions_clustered.gff'    // This one is giving a parsing error
      // const uri = 'TAIR_GFF3_ssrs.gff'
      this.indexDriver(uri, false, indexAttributes, fileDirectory)
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
    if (typeof uris === 'string') uris = [uris] // turn uris string into an array of one string

    let aggregateStream = new PassThrough()
    let numStreamsFlowing = uris.length

    //  For each uri, we parse the file and add it to aggregateStream.
    for (const uri of uris) {
      // Generate transform function parses an @gmod/gff stream.
      const gffTranform = new Transform({
        objectMode: true,
        transform: (chunk, _encoding, done) => {
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
      gff3Stream.once('end', () => {
        if (--numStreamsFlowing === 0) aggregateStream.end()
        else aggregateStream.push('\n')
      })
    }

    return this.runIxIxx(aggregateStream, isTest, outLocation)
  }

  // Take in the local file path, check if the it is gzipped or not,
  // then passes it into the correct file handler.
  // Returns a @gmod/gff stream.
  handleLocalGff3(gff3LocalIn: string, isGZ: boolean) {
    let gff3ReadStream: ReadStream = createReadStream(gff3LocalIn)
    if (!isGZ) return this.parseGff3Stream(gff3ReadStream)
    else return this.handleLocalGzip(gff3ReadStream)
  }

  // Method for handing off the parsing of a gff3 file URL.
  // Calls the proper parser depending on if it is gzipped or not.
  // Returns a @gmod/gff stream.
  async handleGff3Url(urlIn: string, isGZ: boolean): Promise<ReadStream> {
    if (!isGZ) return this.handleGff3UrlNoGz(urlIn)
    else return this.handleGff3UrlWithGz(urlIn)
  }

  // Grabs the remote file from urlIn, then pipe it directly to parseGff3Stream()
  // for parsing and indexing.
  // Returns a promise for the resulting @gmod/gff stream.
  handleGff3UrlNoGz(urlIn: string) {
    const newUrl = new URL(urlIn)

    let promise = new Promise<ReadStream>((resolve, reject) => {
      if (newUrl.protocol === 'https:') {
        httpsFR
          .get(urlIn, (response: IncomingMessage & FollowResponse) => {
            const parseStream = this.parseGff3Stream(response)
            resolve(parseStream)
          })
          .on('error', (e: NodeJS.ErrnoException) => {
            reject('fail')
            if (e.code === 'ENOTFOUND') this.error('Bad file url')
            else this.error('Other error: ', e)
          })
      } else {
        httpFR
          .get(urlIn, (response: IncomingMessage & FollowResponse) => {
            const parseStream = this.parseGff3Stream(response)
            resolve(parseStream)
          })
          .on('error', (e: NodeJS.ErrnoException) => {
            reject('fail')
            if (e.code === 'ENOTFOUND') this.error('Bad file url')
            else this.error('Other error: ', e)
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

    let promise = new Promise<ReadStream>((resolve, reject) => {
      if (newUrl.protocol === 'https:') {
        httpsFR
          .get(urlIn, (response: IncomingMessage & FollowResponse) => {
            const parseStream = this.parseGff3Stream(response.pipe(unzip))
            resolve(parseStream)
          })
          .on('error', (e: NodeJS.ErrnoException) => {
            reject('fail')
            if (e.code === 'ENOTFOUND') this.error('Bad file url')
            else this.error('Other error: ', e)
          })
      } else {
        httpFR
          .get(urlIn, (response: IncomingMessage & FollowResponse) => {
            const parseStream = this.parseGff3Stream(response.pipe(unzip))
            resolve(parseStream)
          })
          .on('error', (e: NodeJS.ErrnoException) => {
            reject('fail')
            if (e.code === 'ENOTFOUND') this.error('Bad file url')
            else this.error('Other error: ', e)
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
    let gff3Stream: ReadStream = gff3In.pipe(
      gff.parseStream({ parseSequences: false }),
    )

    return gff3Stream
  }

  // Recursively goes through every record in the gff3 file and gets
  // the desired attributes in the form of a JSON object. It is then
  // pushed to gff3Stream in proper indexing format.
  async recurseFeatures(
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

      let getAndPushRecord = (subRecord: any) => {
        let recordObj: any = {}
        let attrString: string = ''

        for (let attr of attributesArr) {

          // Currently do not index start or end values for searching, but do include the attributes in search results.
          // TODO: consider not using 'start' or 'end, and instead allow the user to customize
          //        searchTermAttributes vs. searchResultAttributes in the config.json
          if (attr == 'start' || attr == 'end')
            continue

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
        let buff = Buffer.from(JSON.stringify(recordObj), 'utf-8')
        let str: string = buff.toString() 
        str += attrString + '\n'

        // replace the separator characters with 
        // percent encoding characters
        str = str.replace(/,/g, '%2C')
        str = str.replace(/\s/, '%20')

        //encoding using shorter before pushing
        str = compress(str)

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
    const ixFileName: string = 'out.ix'
    const ixxFileName: string = 'out.ixx'

    let ixProcess: ChildProcessWithoutNullStreams

    if (isTest)
      // If this is a test, output to test/data/ directory, and use the local version of ixIxx.
      ixProcess = spawn(
        'cat | ./products/jbrowse-cli/test/ixIxx /dev/stdin',
        [
          './products/jbrowse-cli/test/data/out.ix',
          './products/jbrowse-cli/test/data/out.ixx',
        ],
        { shell: true },
      )
    // Otherwise require user to have ixIxx in their system path.
    else
      ixProcess = spawn(
        'cat | ixIxx /dev/stdin',
        [outLocation + ixFileName, outLocation + ixxFileName],
        {
          shell: true,
        },
      )

    // Pass the readStream as stdin into ixProcess.
    readStream.pipe(ixProcess.stdin).on('error', e => {
      console.log(`Error writing data to ixIxx. ${e}`)
    })

    // End the ixProcess stdin when the stream is done.
    readStream.on('end', () => {
      ixProcess.stdin.end()
    })

    ixProcess.stdout.on('data', data => {
      this.log(`Output from ixIxx: ${data}`)
    })

    let promise = new Promise((resolve, reject) => {
      ixProcess.on('close', code => {
        if (code == 0) {
          resolve('Success!')
          // Code should = 0 for success
          this.log(
            `Indexing done! Check ${ixFileName} and ${ixxFileName} files for output.`,
          )
          return code
        } else {
          reject(`ixIxx exited with code: ${code}`)
        }
      })

      // Hook up the reject from promise on error
      ixProcess.stderr.on('data', data => {
        reject(`Error with ixIxx: ${data}`)
      })
    }).catch(errorData => {
      // Catch any promise rejection errors with running ixIxx here.

      if (errorData.includes('not found')) {
        console.error('ixIxx was not found in your system.')
      } else {
        console.log(errorData)
      }
    })

    return promise
  }

  // Function that takes in an array of tracks and returns an array of
  // identifiers stating what will be indexed.
  // Params:
  //  trackIds: array of string ids for tracks to index
  //  runFlags: specify if there is a target ouput location for the indexing
  async getIndexingConfigurations(trackIds: Array<string>, runFlags: any) {
    // are we planning to have target and output flags on this command?
    const output = runFlags?.target || runFlags?.out || '.'
    const isDir = (await promises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output
    const config: Config = await this.readJsonFile(this.target)
    if (!config.tracks) {
      this.error(
        'Error, no tracks found in config.json. Please add a track before indexing.',
      )
    }
    const configurations = trackIds.map(trackId => {
      const currentTrack = config.tracks.find(
        track => trackId === track.trackId,
      )
      if (currentTrack) {
        const { adapter, attributes } = currentTrack
        if (adapter.type === 'Gff3TabixAdapter') {
          return {
            trackId,
            indexingConfiguration: {
              indexingAdapter: 'GFF3',
              gzipped: true,
              gffLocation: adapter?.gffGzLocation,
            },
            attributes: adapter?.attributes,
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
  }
}
