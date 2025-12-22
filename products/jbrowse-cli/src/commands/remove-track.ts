import { parseArgs } from 'util'

import {
  printHelp,
  readJsonFile,
  resolveConfigPath,
  writeJsonFile,
} from '../utils'

import type { Config } from '../base'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
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

  const description =
    'Remove a track configuration from a JBrowse 2 configuration. Be aware that this can cause crashes in saved sessions that refer to this track!'

  const examples = ['$ jbrowse remove-track trackId']

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse remove-track <trackId> [options]',
      options,
    })
    return
  }

  const trackId = positionals[0]
  if (!trackId) {
    throw new Error(
      'Missing required argument: trackId\nUsage: jbrowse remove-track <trackId> [options]',
    )
  }

  const target = await resolveConfigPath(flags.target, flags.out)

  const config: Config = await readJsonFile(target)

  const originalLength = config.tracks?.length || 0
  config.tracks = config.tracks?.filter(
    ({ trackId: id }: { trackId: string }) => id !== trackId,
  )
  const newLength = config.tracks?.length || 0

  if (originalLength === newLength) {
    console.log(`No track found with trackId: ${trackId}`)
  } else {
    await writeJsonFile(target, config)
    console.log(`Removed track with trackId: ${trackId} from ${target}`)
  }
}
