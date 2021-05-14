import { flags } from '@oclif/command'
import JBrowseCommand, { Config } from '../base'
import { ReadStream, createReadStream, promises } from 'fs'
import { Transform } from 'stream'
import gff from '@gmod/gff'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { http as httpFR, https as httpsFR } from 'follow-redirects'
import { createGunzip } from "zlib"


type trackConfig = {
  'trackId': string,
  'indexingConfiguration': {
    'indexingAdapter': string,
    'gzipped': boolean,
    'gffLocation': {
      'uri': string,
    }
  },
  'attributes': Array<String>
}


export default class TextIndex extends JBrowseCommand {
  // @ts-ignore
  target: string

  static description = 'Make a single-track text index for the given track.'

  static examples = [
    '$ jbrowse text-index',
    '$ jbrowse text-index --tracks=track1,track2,track3',
    '$ jbrowse text-index --individual --tracks=my_track_id',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    tracks: flags.string({
      description: `Specify the tracks to index, formatted as comma separated trackIds`,
    }),
    individual: flags.boolean({
      description: 'Only make a single-track text index for the given track',
    }),
  }

  // Called when running the terminal command. Parses the given flags
  // and tracks associated. Gets their information and sends it to the
  // appropriate file parser to be indexed
  async run() {
    const { flags: runFlags } = this.parse(TextIndex)

    this.debug(`Command loaded`)

    if (runFlags.individual) {
      if (runFlags.tracks) {
        const trackIds: string = runFlags.tracks
        if (trackIds.split(',').length > 1) {
          this.error(
            'Error, --individual flag only allows one track to be indexed',
          )
        } else {
          this.log(
            `TODO: implement individual indexing for this track: ${runFlags.tracks}`,
          )
        }
      } else {
        this.error('Error, please specify a track to index.')
      }
    } else if (runFlags.tracks) {
      const trackIds: Array<string> = runFlags.tracks.split(',')

      const configurationsList = await this.getIndexingConfigurations(trackIds, runFlags)

      this.log(
        `TODO: implement aggregate text indexing for these tracks: ${trackIds}`,
      )
    } else {

      // For testing:
      // const gff3FileLocation: string = "./test/data/au9_scaffold_subset_sync.gff3"
      // const gff3FileLocation: string = 'https://github.com/GMOD/jbrowse-components/blob/cli_trix_indexer/test_data/volvox/volvox.sort.gff3.gz?raw=true'
      // const gff3FileLocation = 'https://raw.githubusercontent.com/GMOD/jbrowse/master/tests/data/au9_scaffold_subset_sync.gff3'
      // const gff3FileLocation = 'https://github.com/GMOD/jbrowse-components/raw/cli_trix_indexer/test_data/volvox/volvox.sort.gff3.gz'

      // // Check if the file is a URL, then index it.
      // if (this.isURL(gff3FileLocation))
      //   this.parseGff3Url(gff3FileLocation, true, false)
      // else
      //   this.parseLocalGff3(gff3FileLocation, true, false)


      // this.log(
      //   'TODO: index all locally configured tracks into an aggregate, equivalent to --tracks (all_track_ids) ',
      // )

      // repeats_hg19
      // gff3tabix_genes
      
      const trackIds: Array<string> = ['gff3tabix_genes']
      const indexConfig = await this.getIndexingConfigurations(trackIds, null)
      // TODO: Fix this
      // const uri = indexConfig[0].indexingConfiguration.gffLocation.uri;
      // this.parseLocalGff3(uri, true, true)
    }
  }




  // Diagram of function call flow:
  // 
  //                       -------------------------------------
  // parseLocalGff3() -- /                                      \
  //                     \                                       \
  //                      ---->  parseLocalGzip()  -------------- \
  //                                                               \
  //                                                                ------>  indexGff3()  ----->  runIxIxx()  --->  Indexed files created (.ix and .ixx)
  //                                                               /           ↓    ↑ 
  //                      ---->  parseGff3UrlNoGz() -----------  /        recurse_features()   
  //  parseGff3Url() ---/                                      /           
  //                    \                                    /
  //                      ---->  parseGff3UrlWithGz() ------
  //
  //




  // Take in the local file path, check if the
  // it is gzipped or not, then passes it into the correct
  // file handler
  async parseLocalGff3(gff3LocalIn: string, isGZ: boolean, isTest: boolean){
    let gff3ReadStream: ReadStream = createReadStream(gff3LocalIn);
    if(!isGZ)
      await this.indexGff3(gff3ReadStream, isTest)
    else
      await this.parseLocalGzip(gff3ReadStream, isTest)
  }

  // Method for handing off the parsing of a gff3 file URL.
  // Calls the proper parser depending on if it is gzipped or not.
  async parseGff3Url(urlIn: string, isGZ: boolean, isTest: boolean) {
    if (!isGZ)
      await this.parseGff3UrlNoGz(urlIn, isTest)
    else
      await this.parseGff3UrlWithGz(urlIn, isTest)
  }
  
  
  // Grabs the remote file from urlIn, then pipe it directly to parseGff3()
  // for parsing and indexing. Awaits promise until the child process
  // is complete and resolves the promise.
  private async parseGff3UrlNoGz(urlIn: string, isTest: boolean) {
    const newUrl = new URL(urlIn)
  
    if (newUrl.protocol === "https:") {
      new Promise((resolve, reject) => {

        httpsFR
          .get(urlIn, async (res) => {
            await this.indexGff3(res, isTest)
            resolve("success")
          })
          .on("error", (e: NodeJS.ErrnoException) => {
            if (e.code === "ENOTFOUND") this.error("Bad file url")
            else this.error("Other error: ", e)
          })

      })
    } else {
      new Promise((resolve, reject) => {

        httpFR
          .get(urlIn, async (res) => {
            await this.indexGff3(res, isTest)
            resolve("success")
          })
          .on("error", (e: NodeJS.ErrnoException) => {
            if (e.code === "ENOTFOUND") this.error("Bad file url")
            else this.error("Other error: ", e)
          })

      })
    }
  }


  // Grab the remote file from urlIn, then unzip it before
  // piping into parseGff3 for parsing and indexing. Awaits 
  // a promise until the child proccess is complete and
  // indexing is complete.
  private async parseGff3UrlWithGz(urlIn: string, isTest: boolean) {
    const unzip = createGunzip()
    const newUrl = new URL(urlIn)

    if (newUrl.protocol === "https:") {
      new Promise((resolve, reject) => {   

        httpsFR
        .get(urlIn, async (response) => {
          await this.indexGff3(response.pipe(unzip), isTest)
          resolve("success")
        })
        .on("error", (e: NodeJS.ErrnoException) => {
          if (e.code === "ENOTFOUND") this.error("Bad file url")
          else this.error("Other error: ", e)
        })

      })
    } else {
      new Promise((resolve, reject) => {

        httpFR
          .get(urlIn, async (response) => {
            await this.indexGff3(response.pipe(unzip), isTest)
            resolve("success")
          })
          .on("error", (e: NodeJS.ErrnoException) => {
            if (e.code === "ENOTFOUND") this.error("Bad file url")
            else this.error("Other error: ", e)
          })

      }) 
    }
  }



  // Checks if the passed in string is a valid URL. 
  // Returns a boolean.
  isURL(FileName: string) {
    let url

    try {
      url = new URL(FileName);
    } catch (_) {
      return false
    }

    return url.protocol === "http:" || url.protocol === "https:"
  }

  // Handles local gZipped files by unzipping them
  // then passing them into the parseGff3()
  private async parseLocalGzip(file: ReadStream, isTest: boolean){
    const unzip = createGunzip()

    let gZipRead: ReadStream = file.pipe(unzip)
    await this.indexGff3(gZipRead, isTest)
  } 

  // Function that takes in a gff3 readstream and parses through
  // it and retrieves the needed attributes and information.
  private async indexGff3(gff3In: ReadStream, isTest: boolean) {
    const gffTranform = new Transform({
      objectMode: true,
      transform: (chunk, _encoding, done) => {
          chunk.forEach((record: RecordData) => {
              this.recurseFeatures(record, gff3Stream)
              done()
          })
      }
    })
      
    const gff3Stream: ReadStream = gff3In.pipe(gff.parseStream({parseSequences: false})).pipe(gffTranform)
      
    await this.runIxIxx(gff3Stream, isTest)
  }


  // Recursively goes through every record in the gff3 file and gets
  // the desires attributes in the form of a JSON object. It is then pushed
  // and returned to the ixIxx file to run.
  private recurseFeatures(record: RecordData, gff3Stream: ReadStream) {

    const recordObj = { "ID":record.attributes.ID,
                        "Name":record.attributes.Name,
                        "seq_id": record.seq_id, 
                        "start": record.start,
                        "end": record.end
                      }

    if(record.attributes.Name && record.attributes.ID){

        let buff = Buffer.from(JSON.stringify(recordObj), 'utf-8')

        let str: string = (`${buff.toString('base64')} ${record.attributes.ID} ${record.attributes.Name} ${record.attributes.ID}\n`)
        gff3Stream.push(str)
    }

    for(let j = 0; record.length; j++){
        for(let i = 0; i < record[j].child_features.length; i++){
            this.recurseFeatures(record[j].child_features[i], gff3Stream)
        }
    }
  }

  // Given a readStream of data, indexes the stream into .ix and .ixx files using ixIxx.
  // The ixIxx executable is required on the system path for users, however tests use a local copy.
  // Returns the exit code of child process ixIxx.
  async runIxIxx(readStream: ReadStream, isTest: boolean){
    const ixFileName: string = "out.ix"
    const ixxFileName: string = "out.ixx"
    
    // debugger;

    let ixProcess: ChildProcessWithoutNullStreams

    if (isTest)
      // If this is a test, output to test/data/ directory, and use the local version of ixIxx.
      ixProcess = spawn('cat | ./products/jbrowse-cli/test/ixIxx /dev/stdin', ['./products/jbrowse-cli/test/data/out.ix', './products/jbrowse-cli/test/data/out.ixx'], { shell: true })   
    else
      // Otherwise require user to have ixIxx in their system path.
      ixProcess = spawn('cat | ixIxx /dev/stdin', [ixFileName, ixxFileName], { shell: true })

    // Pass the readStream as stdin into ixProcess.
    readStream.pipe(ixProcess.stdin)

    // End the ixProcess stdin when the stream is done.
    readStream.on('end', () => {
        ixProcess.stdin.end()
    })

    ixProcess.stdout.on('data', (data) => {
        this.log(`Output from ixIxx: ${data}`)
    })

    ixProcess.stderr.on('data', (data) => {
        this.error(`Error with ixIxx: ${data}`)
    })

    await new Promise(resolve => {
      ixProcess.on('close', (code) => {
        resolve('Success!')
        this.log(`Indexing done! Check ${ixFileName} and ${ixxFileName} files for output.`)
        return code;
      })
    })

    return -1;
  }

  // Function that takes in an array of tracks and returns an array of
  // identifiers stating what will be indexed. 
  // Params:
  //  trackIds: array of string ids for tracks to index
  //  runFlags: specify if there is a target ouput location for the indexing
  async getIndexingConfigurations(trackIds: Array<string>, runFlags: any){
    // are we planning to have target and output flags on this command?
    const output = runFlags?.target || runFlags?.out || '.'
    const isDir = (await promises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output
    const config: Config = await this.readJsonFile(this.target)
    if (!config.tracks) {
      this.error('Error, no tracks found in config.json. Please add a track before indexing.')
    }
    debugger;
    const configurations = trackIds.map(trackId => {
      const track = config.tracks.find(
        (track) => trackId === track.trackId,
      )
      if (track) {
        const {adapter} = track
        // instantiate their data adapters
        // if filetype is gff3
        // runn gff3 processor
        if (adapter.type === 'Gff3TabixAdapter') {
          return {
            trackId,
            indexingConfiguration: {
              indexingAdapter: 'GFF3',
              gzipped: true,
              gffLocation: adapter?.gffGzLocation,
            },
            attributes: []
          }
        }
      } else {
        this.error(`Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`)
      }
      return {}
    })
    return configurations
  }
}
