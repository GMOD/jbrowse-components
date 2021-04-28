import { flags } from '@oclif/command'
import JBrowseCommand from '../base'
import { ReadStream, createReadStream } from 'fs'
import { Transform } from 'stream'
import gff from '@gmod/gff'
import { spawn } from 'child_process'

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
          this.log(
            'Error, --individual flag only allows one track to be indexed',
          )
        } else {
          this.log(
            `TODO: implement individual indexing for this track: ${runFlags.tracks}`,
          )
        }
      } else {
        this.log('Error, please specify a track to index.')
      }
    } else if (runFlags.tracks) {
      const trackIds: Array<string> = runFlags.tracks.split(',')
      this.log(
        `TODO: implement aggregate text indexing for these tracks: ${trackIds}`,
      )
    } else {

      // For testing:
      const gff3FileName2: string = "./test/data/au9_scaffold_subset_sync.gff3"
      const gff3In = createReadStream(gff3FileName2)
      this.parseGff3(gff3In)

      this.log(
        'TODO: index all locally configured tracks into an aggregate, equivalent to --tracks (all_track_ids) ',
      )
    }
  }

  async parseGff3(gff3In: ReadStream) {
    
    const gffTranform = new Transform({
      objectMode: true,
      transform: (chunk, encoding, done) => {
          chunk.forEach(record => {
              this._recurseFeatures(record, gff3Stream)
              done()
          })
      }
    })
      
    const gff3Stream: ReadStream = gff3In.pipe(gff.parseStream({parseSequences: false})).pipe(gffTranform)
      
    this.runIxIxx(gff3Stream)
  }

  private _recurseFeatures(record, gff3Stream: ReadStream) {

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

  async runIxIxx(readStream: ReadStream){
    const ixFileName: string = "out.ix"
    const ixxFileName: string = "out.ixx"

    // readStream.on('error', function(err) {
    //     this.log(err.stack)
    // })
    
    const ixProcess = spawn('cat | ixIxx /dev/stdin', [ixFileName, ixxFileName], { shell: true })

    // Pass the readStream as stdin into ixProcess.
    readStream.pipe(ixProcess.stdin)

    // End the ixProcess stdin when the stream is done.
    readStream.on('end', () => {
        ixProcess.stdin.end()
    })

    ixProcess.stdout.on('data', (data) => {
        this.log(`stdout: ${data}`)
    })

    ixProcess.stderr.on('data', (data) => {
        this.error(`stderr: ${data}`)
    })

    ixProcess.on('close', (code) => {
        this.log(`child process exited with code ${code}`)
    })

    this.log(`Done! Check ${ixFileName} and ${ixxFileName} files for output.`)
  }


}
