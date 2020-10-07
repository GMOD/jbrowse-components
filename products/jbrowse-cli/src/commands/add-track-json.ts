import { flags } from '@oclif/command'
import path from 'path'
import JBrowseCommand, { Config } from '../base'

export default class AddTrackJson extends JBrowseCommand {
  static description =
    'Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-track-json track.json',
    '$ jbrowse add-track-json track.json --update',
  ]

  static args = [
    {
      name: 'track',
      required: true,
      description: `track JSON file or command line arg blob`,
    },
  ]

  static flags = {
    update: flags.boolean({
      char: 'u',
      description: `update the contents of an existing track, matched based on trackId`,
    }),
    target: flags.string({
      description:
        'path to config file in JB2 installation directory to write out to.\nCreates ./config.json if nonexistent',
      default: './config.json',
    }),
  }

  async run() {
    const { args, flags: runFlags } = this.parse(AddTrackJson)
    const { track: inputtedTrack } = args as { track: string }

    this.debug(`Sequence location is: ${inputtedTrack}`)
    const { update, target } = runFlags
    await this.checkLocation(path.dirname(target))

    const config: Config = await this.readJsonFile(target)
    this.debug(`Found existing config file ${target}`)

    const track = await this.readInlineOrFileJson(inputtedTrack)
    if (!config.tracks) {
      config.tracks = []
    }
    const idx = config.tracks.findIndex(
      ({ trackId }: { trackId: string }) => trackId === track.trackId,
    )
    if (idx !== -1) {
      const existing = config.tracks[idx].name
      this.debug(`Found existing track ${existing} in configuration`)
      if (update) {
        this.debug(`Overwriting track ${existing} in configuration`)
        config.tracks[idx] = track
      } else {
        this.error(
          `Cannot add track ${track.name}, a track with that trackId already exists: ${existing}`,
          { exit: 160 },
        )
      }
    } else {
      config.tracks.push(track)
    }
    this.debug(`Writing configuration to file ${target}`)
    await this.writeJsonFile(target, config)
    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${track.name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${target}`,
    )
  }
}
