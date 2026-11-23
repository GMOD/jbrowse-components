import {
  configTargetOptions,
  parseCommand,
  readConfigFile,
  requirePositional,
  resolveConfigPath,
  writeJsonFile,
} from '../utils.ts'

import type { Config } from '../base.ts'

const usage = 'jbrowse remove-track <trackId> [options]'

export async function run(args?: string[]) {
  await parseCommand(args, {
    description:
      'Remove a track configuration from a JBrowse 2 configuration. Be aware that this can cause crashes in saved sessions that refer to this track!',
    usage,
    examples: [
      '# remove a track from the config.json in the current directory',
      '$ jbrowse remove-track my_track_id',
      '',
      '# remove a track from a config.json in a specific installation directory',
      '$ jbrowse remove-track my_track_id --out /path/to/jb2/',
      '',
      '# remove a track from a specific config file',
      '$ jbrowse remove-track my_track_id --target /path/to/jb2/config.json',
    ],
    options: configTargetOptions,
    run: async ({ flags, positionals }) => {
      const trackId = positionals[0]
      requirePositional(trackId, 'trackId', usage)

      const target = await resolveConfigPath(flags.target, flags.out)

      const config: Config = await readConfigFile(target)

      const tracks = config.tracks ?? []
      const remaining = tracks.filter(track => track.trackId !== trackId)

      if (remaining.length === tracks.length) {
        console.log(`No track found with trackId: ${trackId}`)
      } else {
        await writeJsonFile(target, { ...config, tracks: remaining })
        console.log(`Removed track with trackId: ${trackId} from ${target}`)
      }
    },
  })
}
