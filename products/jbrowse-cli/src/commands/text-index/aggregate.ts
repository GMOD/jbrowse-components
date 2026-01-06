import { createTrixAdapter } from './adapter-utils.ts'
import {
  getAssemblyNames,
  getTrackConfigs,
  loadConfigForIndexing,
  parseCommaSeparatedString,
  prepareIndexDriverFlags,
  writeConf,
} from './config-utils.ts'
import { indexDriver } from './indexing-utils.ts'
import { resolveConfigPath } from '../../utils.ts'

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
    dryrun,
    prefixSize,
  } = flags
  const { config, configPath, outLocation } = await loadConfigForIndexing(
    target,
    out,
    resolveConfigPath,
  )

  const aggregateTextSearchAdapters = config.aggregateTextSearchAdapters || []
  const asms = getAssemblyNames(config, assemblies)

  for (const asm of asms) {
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
      console.log(
        trackConfigs.map(e => `${e.trackId}	${e.adapter?.type}`).join('\n'),
      )
    } else {
      const id = `${asm}-index`
      const idx = aggregateTextSearchAdapters.findIndex(
        x => x.textSearchAdapterId === id,
      )
      if (idx !== -1 && !force) {
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
        ...prepareIndexDriverFlags({ attributes, exclude, quiet, prefixSize }),
      })

      const trixConf = createTrixAdapter(asm, [asm])

      if (idx === -1) {
        aggregateTextSearchAdapters.push(trixConf)
      } else {
        aggregateTextSearchAdapters[idx] = trixConf
      }
    }
  }

  if (!dryrun) {
    writeConf(
      {
        ...config,
        aggregateTextSearchAdapters,
      },
      configPath,
    )
  }
}
