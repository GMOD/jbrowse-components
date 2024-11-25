import { promises as fsPromises } from 'fs'
import { Args, Flags } from '@oclif/core'
import JBrowseCommand from '../base'
import type { Config, Track } from '../base'

export default class AddTrackJson extends JBrowseCommand {
  // @ts-expect-error
  target: string

  static description =
    'Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-track-json track.json',
    '$ jbrowse add-track-json track.json --update',
  ]

  static args = {
    track: Args.string({
      required: true,
      description: 'track JSON file or command line arg blob',
    }),
  }

  static flags = {
    update: Flags.boolean({
      char: 'u',
      description:
        'update the contents of an existing track, matched based on trackId',
    }),
    target: Flags.string({
      description:
        'path to config file in JB2 installation directory to write out to.\nCreates ./config.json if nonexistent',
    }),
    out: Flags.string({
      description: 'synonym for target',
    }),
  }

  async run() {
    const { args, flags: runFlags } = await this.parse(AddTrackJson)

    const output = runFlags.target || runFlags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output

    const { track: inputtedTrack } = args as { track: string }

    this.debug(`Sequence location is: ${inputtedTrack}`)
    const { update } = runFlags
    const config: Config = await this.readJsonFile(this.target)
    this.debug(`Found existing config file ${this.target}`)

    const track = await this.readInlineOrFileJson<Track>(inputtedTrack)
    if (!config.tracks) {
      config.tracks = []
    }
    const idx = config.tracks.findIndex(
      ({ trackId }: { trackId: string }) => trackId === track.trackId,
    )
    if (idx !== -1) {
      const existing = config.tracks[idx]?.name
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
    this.debug(`Writing configuration to file ${this.target}`)
    await this.writeJsonFile(this.target, config)
    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${track.name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${this.target}`,
    )
  }
}
