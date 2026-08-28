import { parseCommaSeparatedString, writeJsonFile } from '../../utils.ts'
import { createTrixAdapter } from './adapter-utils.ts'
import {
  formatDryRun,
  getAssemblyNames,
  getTrackConfigs,
  loadConfigForIndexing,
  prepareIndexDriverFlags,
} from './config-utils.ts'
import { indexDriver } from './indexing-utils.ts'

import type { TrixTextSearchAdapter } from '../../base.ts'
import type { TextIndexFlags } from './index.ts'

export async function aggregateIndex(flags: TextIndexFlags): Promise<void> {
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
    dryrun,
    prefixSize,
  } = flags
  const { config, configPath, outLocation } = await loadConfigForIndexing(
    target,
    out,
  )

  const existing = config.aggregateTextSearchAdapters ?? []

  // sequential, not Promise.all: each assembly's indexer owns the progress bar
  // and streams whole files through ixIxx
  const written: TrixTextSearchAdapter[] = []
  for (const asm of getAssemblyNames(config, assemblies)) {
    const trackConfigs = getTrackConfigs(
      config,
      parseCommaSeparatedString(tracks),
      asm,
      parseCommaSeparatedString(excludeTracks),
    )
    if (!trackConfigs.length) {
      console.log(`Indexing assembly ${asm}...(no tracks found)...`)
      continue
    }
    console.log(`Indexing assembly ${asm}...`)

    if (dryrun) {
      console.log(formatDryRun(trackConfigs))
      continue
    }

    const trixConf = createTrixAdapter(asm, [asm])
    if (
      !force &&
      existing.some(x => x.textSearchAdapterId === trixConf.textSearchAdapterId)
    ) {
      console.log(
        `Note: ${asm} has already been indexed with this configuration, use --force to overwrite this assembly. Skipping for now`,
      )
      continue
    }

    await indexDriver({
      trackConfigs,
      outLocation,
      name: asm,
      assemblyNames: [asm],
      ...prepareIndexDriverFlags({
        attributes,
        exclude,
        include,
        quiet,
        prefixSize,
      }),
    })
    written.push(trixConf)
  }

  if (!dryrun) {
    await writeJsonFile(configPath, {
      ...config,
      // upsert by adapter id: a Map keyed on it keeps the first occurrence's
      // position while the last value wins, so re-indexing an assembly replaces
      // its adapter in place and a new one lands at the end
      aggregateTextSearchAdapters: [
        ...new Map(
          [...existing, ...written].map(a => [a.textSearchAdapterId, a]),
        ).values(),
      ],
    })
  }
}
