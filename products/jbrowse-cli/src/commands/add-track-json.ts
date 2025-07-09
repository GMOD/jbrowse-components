import { promises as fsPromises } from 'fs'
import { parseArgs } from 'util'

import NativeCommand from '../native-base'

import type { Config, Track } from '../base'

export default class AddTrackJsonNative extends NativeCommand {
  target = ''

  static description =
    'Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-track-json track.json',
    '$ jbrowse add-track-json track.json --update',
  ]

  async run(args?: string[]) {
    const { values: flags, positionals } = parseArgs({
      args,
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        update: {
          type: 'boolean',
          short: 'u',
          default: false,
        },
        target: {
          type: 'string',
        },
        out: {
          type: 'string',
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
      return
    }

    const track = positionals[0]
    if (!track) {
      console.error('Error: Missing required argument: track')
      console.error('Usage: jbrowse add-track-json <track> [options]')
      process.exit(1)
    }

    const output = flags.target || flags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output

    this.debug(`Sequence location is: ${track}`)
    const { update } = flags
    const config: Config = await this.readJsonFile(this.target)
    this.debug(`Found existing config file ${this.target}`)

    const trackConfig = await this.readInlineOrFileJson<Track>(track)
    if (!config.tracks) {
      config.tracks = []
    }
    const idx = config.tracks.findIndex(
      ({ trackId }: { trackId: string }) => trackId === trackConfig.trackId,
    )
    if (idx !== -1) {
      const existing = config.tracks[idx]?.name
      this.debug(`Found existing track ${existing} in configuration`)
      if (update) {
        this.debug(`Overwriting track ${existing} in configuration`)
        config.tracks[idx] = trackConfig
      } else {
        console.error(
          `Error: Cannot add track ${trackConfig.name}, a track with that trackId already exists: ${existing}`,
        )
        process.exit(160)
      }
    } else {
      config.tracks.push(trackConfig)
    }
    this.debug(`Writing configuration to file ${this.target}`)
    await this.writeJsonFile(this.target, config)
    console.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} track "${trackConfig.name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${this.target}`,
    )
  }

  showHelp() {
    console.log(`
${AddTrackJsonNative.description}

USAGE
  $ jbrowse add-track-json <track> [options]

ARGUMENTS
  track  track JSON file or command line arg blob

OPTIONS
  -h, --help         Show help
  -u, --update       Update the contents of an existing track, matched based on trackId
  --target <target>  Path to config file in JB2 installation directory to write out to
  --out <out>        Synonym for target

EXAMPLES
${AddTrackJsonNative.examples.join('\n')}
`)
  }
}
