import {
  configTargetOptions,
  debug,
  isRecord,
  parseCommand,
  readInlineOrFileJson,
  readConfigFile,
  requirePositional,
  resolveConfigPath,
} from '../utils.ts'
import { upsertConfigEntry } from './shared/config-operations.ts'

import type { Config, Track } from '../base.ts'

function isTrack(value: unknown): value is Track {
  return isRecord(value) && typeof value.trackId === 'string'
}

const options = {
  update: {
    type: 'boolean',
    short: 'u',
    description:
      'Update the contents of an existing track, matched based on trackId',
  },
  ...configTargetOptions,
} as const

const description =
  'Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration'

const usage = 'jbrowse add-track-json <track> [options]'

const notes =
  'The track argument is a JSON file, inline JSON, or "-" to read the JSON ' +
  'from stdin, so a track config can be generated and piped straight in.'

const examples = [
  '# add a track from a JSON file',
  '$ jbrowse add-track-json track.json',
  '',
  '# update an existing track (matched by trackId) with new JSON contents',
  '$ jbrowse add-track-json track.json --update',
  '',
  '# pass the track config inline instead of via a file',
  `$ jbrowse add-track-json '{"type":"FeatureTrack","trackId":"genes","assemblyNames":["hg38"],"adapter":{"type":"Gff3TabixAdapter","gffGzLocation":{"uri":"genes.gff.gz"}}}'`,
  '',
  '# pipe the track config in from another program',
  `$ jq '.tracks[0]' other/config.json | jbrowse add-track-json -`,
  '',
  '# write to a config.json in a specific installation directory',
  '$ jbrowse add-track-json track.json --out /path/to/jb2/',
]

export async function run(args?: string[]) {
  await parseCommand(args, {
    description,
    examples,
    notes,
    usage,
    options,
    run: async ({ flags, positionals }) => {
      const track = positionals[0]
      requirePositional(track, 'track', usage)

      const target = await resolveConfigPath(flags.target, flags.out)

      const { update } = flags
      const config: Config = await readConfigFile(target)
      debug(`Found existing config file ${target}`)

      const parsed: unknown = await readInlineOrFileJson(track)
      if (isTrack(parsed)) {
        await upsertConfigEntry({
          config,
          target,
          collection: 'tracks',
          items: config.tracks ?? [],
          entry: parsed,
          idField: 'trackId',
          itemType: 'track',
          itemName: parsed.name ?? parsed.trackId,
          force: update,
        })
      } else {
        throw new Error(
          'The track JSON must be an object with a string "trackId", e.g. {"trackId":"genes", ...}',
        )
      }
    },
  })
}
