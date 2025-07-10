import { promises as fsPromises } from 'fs'
import { parseArgs } from 'util'

import NativeCommand, { printHelp } from '../native-base'

import type { Config } from '../base'

export default class RemoveTrackNative extends NativeCommand {
  target = ''

  static description =
    'Remove a track configuration from a JBrowse 2 configuration. Be aware that this can cause crashes in saved sessions that refer to this track!'

  static examples = ['$ jbrowse remove-track trackId']

  async run(args?: string[]) {
    const options = {
      help: {
        type: 'boolean',
        short: 'h',
        description: 'Show help',
      },
      target: {
        type: 'string',
        description:
          'Path to config file in JB2 installation directory to write out to',
      },
      out: {
        type: 'string',
        description: 'Synonym for target',
      },
    } as const
    const { values: flags, positionals } = parseArgs({
      args,
      options,
      allowPositionals: true,
    })

    if (flags.help) {
      printHelp({
        description: RemoveTrackNative.description,
        examples: RemoveTrackNative.examples,
        usage: 'jbrowse remove-track <trackId> [options]',
        options,
      })
      return
    }

    const trackId = positionals[0]
    if (!trackId) {
      console.error('Error: Missing required argument: trackId')
      console.error('Usage: jbrowse remove-track <trackId> [options]')
      process.exit(1)
    }

    const output = flags.target || flags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output

    const config: Config = await this.readJsonFile(this.target)

    const originalLength = config.tracks?.length || 0
    config.tracks = config.tracks?.filter(
      ({ trackId: id }: { trackId: string }) => id !== trackId,
    )
    const newLength = config.tracks?.length || 0

    if (originalLength === newLength) {
      console.log(`No track found with trackId: ${trackId}`)
    } else {
      await this.writeJsonFile(this.target, config)
      console.log(`Removed track with trackId: ${trackId} from ${this.target}`)
    }
  }
}
