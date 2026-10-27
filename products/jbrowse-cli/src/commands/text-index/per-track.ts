import { trixFileUris } from '@jbrowse/text-indexing-core'

import { parseCommaSeparatedString, writeJsonFile } from '../../utils.ts'
import { createTrixAdapter, indexFileOf } from './adapter-utils.ts'
import {
  formatDryRun,
  getTrackConfigs,
  loadConfigForIndexing,
  prepareIndexDriverFlags,
} from './config-utils.ts'
import { indexDriver } from './indexing-utils.ts'
import {
  validateAssembliesForPerTrack,
  validateTrackConfigs,
} from './validators.ts'

import type { SearchIndexEntry, Track } from '../../base.ts'
import type { TextIndexFlags } from './index.ts'

export async function perTrackIndex(flags: TextIndexFlags): Promise<void> {
  const {
    out,
    target,
    tracks,
    excludeTracks,
    assemblies,
    attributes,
    quiet,
    force,
    exclude,
    include,
    prefixSize,
    dryrun,
  } = flags
  validateAssembliesForPerTrack(assemblies)
  const { config, configPath, outLocation } = await loadConfigForIndexing(
    target,
    out,
  )
  const configTracks = config.tracks ?? []
  const confs = getTrackConfigs(
    config,
    parseCommaSeparatedString(tracks),
    undefined,
    parseCommaSeparatedString(excludeTracks),
  )
  validateTrackConfigs(confs)
  if (dryrun) {
    console.log(formatDryRun(confs))
    return
  }

  // sequential, not Promise.all: each track's indexer owns the progress bar and
  // streams a whole file through ixIxx
  const indexed: Track[] = []
  for (const trackConfig of confs) {
    const { textSearching, trackId, assemblyNames } = trackConfig
    if (textSearching?.textSearchAdapter && !force) {
      console.log(
        `Note: ${trackId} has already been indexed with this configuration, use --force to overwrite this track. Skipping for now`,
      )
      continue
    }
    console.log(`Indexing track ${trackId}...`)

    await indexDriver({
      trackConfigs: [trackConfig],
      outLocation,
      name: trackId,
      assemblyNames,
      ...prepareIndexDriverFlags({
        attributes,
        exclude,
        include,
        quiet,
        prefixSize,
      }),
    })
    indexed.push(trackConfig)
  }

  // a track keeps an adapter that already names the files just written, however
  // it spells them; any other adapter — none, desktop's own index, one written
  // by hand — is replaced, or --force would refresh files nothing reads.
  // getTrackConfigs returns elements of config.tracks, so every indexed track is
  // somewhere in configTracks.
  const newAdapters = new Map(
    indexed.flatMap(({ trackId, assemblyNames, textSearching }) => {
      const adapter = createTrixAdapter(trackId, assemblyNames)
      const existing = textSearching?.textSearchAdapter as
        | SearchIndexEntry
        | undefined
      return existing && indexFileOf(existing) === trixFileUris(trackId).ix
        ? []
        : [[trackId, adapter] as const]
    }),
  )
  const updatedTracks = configTracks.map(track => {
    const textSearchAdapter = newAdapters.get(track.trackId)
    return textSearchAdapter
      ? {
          ...track,
          textSearching: { ...track.textSearching, textSearchAdapter },
        }
      : track
  })

  if (updatedTracks.some((track, i) => track !== configTracks[i])) {
    await writeJsonFile(configPath, { ...config, tracks: updatedTracks })
  }
}
