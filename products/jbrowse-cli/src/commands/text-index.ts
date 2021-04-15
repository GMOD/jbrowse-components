import { flags } from '@oclif/command'
import JBrowseCommand from '../base'

export default class TextIndex extends JBrowseCommand {
  // @ts-ignore
  target: string

  static description = 'Make a single-track text index for the given track.'

  static examples = [
    '$ jbrowse text-index',
    '$ jbrowse text-index --tracks track1,track2,track3',
    '$ jbrowse text-index --individual --tracks my_track_id',
  ]

  static args = [
    // {
    //   name: 'tracks',
    //   required: false,
    //   description: `comma separated trackIds`,
    // },
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
      this.log(
        'TODO: index all locally configured tracks into an aggregate, equivalent to --tracks (all_track_ids) ',
      )
    }
  }
}
