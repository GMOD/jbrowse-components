import { promises as fsPromises } from 'fs'
import { Args, Flags } from '@oclif/core'
import JBrowseCommand from '../base'
import type { Config } from '../base'

export default class RemoveTrackJson extends JBrowseCommand {
  // @ts-expect-error
  target: string

  static description =
    'Remove a track configuration from a JBrowse 2 configuration. Be aware that this can cause crashes in saved sessions that refer to this track!'

  static examples = ['$ jbrowse remove-track-json trackId']

  static args = {
    track: Args.string({
      required: true,
      description: 'track JSON file or command line arg blob',
    }),
  }

  static flags = {
    target: Flags.string({
      description:
        'path to config file in JB2 installation directory to write out to.\nCreates ./config.json if nonexistent',
    }),
    out: Flags.string({
      description: 'synonym for target',
    }),
  }

  async run() {
    const { args, flags: runFlags } = await this.parse(RemoveTrackJson)

    const output = runFlags.target || runFlags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output

    const { track: inputId } = args as { track: string }

    const config: Config = await this.readJsonFile(this.target)

    config.tracks = config.tracks?.filter(
      ({ trackId }: { trackId: string }) => trackId !== inputId,
    )

    await this.writeJsonFile(this.target, config)
  }
}
