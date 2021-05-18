import { flags } from '@oclif/command'
import JBrowseCommand, { Config } from '../base'
import { ReadStream, createReadStream, promises } from 'fs'
import { Transform } from 'stream'
import gff from '@gmod/gff'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'

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
      const gff3FileName2: string = "./test/data/au9_scaffold_subset_sync.gff3"
      const gff3In = createReadStream(gff3FileName2)
      this.parseGff3(gff3In, false)

      this.log(
        'TODO: index all locally configured tracks into an aggregate, equivalent to --tracks (all_track_ids) ',
      )
    }
  }

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

  async runIxIxx(readStream: ReadStream, isTest: boolean){
    const ixFileName: string = "out.ix"
    const ixxFileName: string = "out.ixx"

    // readStream.on('error', function(err) {
    //     this.log(err.stack)
    //  })

    let ixProcess: ChildProcessWithoutNullStreams;
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

    // ixProcess.on('close', (code) => {
    //     this.log(`child process exited with code ${code}`)
    // })

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
            attributes,
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
