import { flags } from '@oclif/command'
import JBrowseCommand, { Config } from '../base'
import { ReadStream, createReadStream, promises } from 'fs'
import { Transform } from 'stream'
import gff from '@gmod/gff'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { http as httpFR, https as httpsFR } from 'follow-redirects'
import { createGunzip } from "zlib"

type RecordData = {
  attributes: any;
  start: Number;
  end: Number;
  seq_id: String;
  length:Number;
};

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
      const gff3FileLocation = 'https://github.com/GMOD/jbrowse-components/raw/cli_trix_indexer/test_data/volvox/volvox.sort.gff3.gz'

      // Check if the file is a URL, then index it.
      if (this.isURL(gff3FileLocation))
        this.parseGff3Url(gff3FileLocation, true, true)
      else
        this.parseGff3(createReadStream(gff3FileLocation), false)


      this.log(
        'TODO: index all locally configured tracks into an aggregate, equivalent to --tracks (all_track_ids) ',
      )
    }
  }

  // Grab the local file from the readStream, check if the
  // file is gzipped or not, then passes it into the correct
  // file handler
  parseLocalGff3(gff3LocalIn: ReadStream, isGZ: boolean, isTest: boolean){
    if(!isGZ){
      this.parseGff3(gff3LocalIn, isTest)
    }else{
      this._isLocalGzip(gff3LocalIn, isTest)
    }
  }

  // Method for handing off the parsing of a gff3 file URL.
  // Calls the proper parser depending on if it is gzipped or not.
  parseGff3Url(urlIn: string, isGZ: boolean, isTest: boolean) {
    debugger;
    if (!isGZ)
      this._parseGff3UrlNoGz(urlIn, isTest)
    else
      this._parseGff3UrlWithGz(urlIn, isTest)
  }
  
  // Grab the remote file from urlIn, then unzip it before
  // piping into parseGff3 for parsing and indexing.
  private _parseGff3UrlWithGz(urlIn: string, isTest: boolean) {
    const unzip = createGunzip()
    const newUrl = new URL(urlIn)
    if (newUrl.protocol === "https:") {
      httpsFR
        .get(urlIn, (response) => {
          this.parseGff3(response.pipe(unzip), isTest)
        })
        .on("error", (e: NodeJS.ErrnoException) => {
          if (e.code === "ENOTFOUND") this.error("Bad file url")
          else this.error("Other error: ", e)
        })
    } else {
      httpFR
        .get(urlIn, (response) => {
          this.parseGff3(response.pipe(unzip), isTest)
        })
        .on("error", (e: NodeJS.ErrnoException) => {
          if (e.code === "ENOTFOUND") this.error("Bad file url")
          else this.error("Other error: ", e)
        })
    }
  }
  
  // Grab the remote file from urlIn, then pipe it directly to parseGff3().
  private _parseGff3UrlNoGz(urlIn: string, isTest: boolean) {
    const newUrl = new URL(urlIn)
  
    if (newUrl.protocol === "https:") {
      httpsFR
        .get(urlIn, (res) => {
          this.parseGff3(res, isTest)
        })
        .on("error", (e: NodeJS.ErrnoException) => {
          if (e.code === "ENOTFOUND") this.error("Bad file url")
          else this.error("Other error: ", e)
        })
    } else {
      httpFR
        .get(urlIn, (res) => {
          this.parseGff3(res, isTest)
        })
        .on("error", (e: NodeJS.ErrnoException) => {
          if (e.code === "ENOTFOUND") this.error("Bad file url")
          else this.error("Other error: ", e)
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
  // then passing them into the gff3 parser
  private _isLocalGzip(file: ReadStream, isTest: boolean){
    const unzip = createGunzip()

    let gZipRead: ReadStream = file.pipe(unzip)
    this.parseGff3(gZipRead, isTest)
}

  // Function that takes in a gff3 readstream and parses through
  // it and retrieves the needed attributes and information.
  // Returns the exit code of child process ixIxx.
  async parseGff3(gff3In: ReadStream, isTest: boolean) {
    const gffTranform = new Transform({
      objectMode: true,
      transform: (chunk, _encoding, done) => {
          chunk.forEach((record: RecordData) => {
              this._recurseFeatures(record, gff3Stream)
              done()
          })
      }
    })
      
    const gff3Stream: ReadStream = gff3In.pipe(gff.parseStream({parseSequences: false})).pipe(gffTranform)
      
    this.runIxIxx(gff3Stream, isTest)
  }


  // Recursively goes through every record in the gff3 file and gets
  // the desires attributes in the form of a JSON object. It is then pushed
  // and returned to the ixIxx file to run.
  private _recurseFeatures(record: RecordData, gff3Stream: ReadStream) {

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
            this._recurseFeatures(record[j].child_features[i], gff3Stream)
        }
    }
  }

  // Given a readStream of data, indexes the stream into .ix and .ixx files using ixIxx.
  // The ixIxx executable is required on the system path for users, however tests use a local copy.
  // Returns the exit code of child process ixIxx.
  async runIxIxx(readStream: ReadStream, isTest: boolean){
    const ixFileName: string = "out.ix"
    const ixxFileName: string = "out.ixx"

    // readStream.on('error', function(err) {
    //     this.log(err.stack)
    //  })
    
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

    ixProcess.on('close', (code) => {
        // this.log(`child process exited with code ${code}`)
        return code;
    })

    this.log(`Indexing done! Check ${ixFileName} and ${ixxFileName} files for output.`)
  }




  
  async getIndexingConfigurations(trackIds: Array<string>, runFlags: any){
    // are we planning to have target and output flags on this command?
    const output = runFlags?.target || runFlags?.out || '.'
    const isDir = (await promises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output
    const config: Config = await this.readJsonFile(this.target)
    if (!config.tracks) {
      this.error('Error, no tracks found in config.json. Please add a track before indexing.')
    }
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
