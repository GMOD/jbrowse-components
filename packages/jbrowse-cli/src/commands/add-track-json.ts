import { flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import JBrowseCommand from '../base'

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
    configLocation: flags.string({
      char: 'c',
      description:
        'Write to a certain config.json file. Defaults to out/config.json if not specified',
    }),
    out: flags.string({
      char: 'o',
      description:
        'path to JB2 installation, writes out to out/config.json unless configLocation flag specified.\nCreates out/config.json if nonexistent',
      default: '.',
    }),
  }

  async run() {
    const { args, flags: runFlags } = this.parse(AddTrackJson)
    const { track: inputtedTrack } = args as { track: string }

    this.debug(`Sequence location is: ${inputtedTrack}`)
    const { update, configLocation: inputtedConfig, out } = runFlags
    await this.checkLocation(runFlags.out)

    const configPath = inputtedConfig || path.join(out, 'config.json')
    const config = JSON.parse(await this.readJsonConfig(configPath))
    this.debug(`Found existing config file ${config}`)

    const track = await this.readInlineOrFileJson(inputtedTrack)
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
    this.debug(`Writing configuration to file ${configPath}`)
    await fsPromises.writeFile(configPath, JSON.stringify(config, undefined, 2))
    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${track.name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${configPath}`,
    )
  }

  async readJsonConfig(location: string) {
    return fsPromises.readFile(location, { encoding: 'utf8' })
  }
}
