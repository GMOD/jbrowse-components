import path from 'path'

import { createTrixAdapter } from './adapter-utils'
import {
  ensureTrixDir,
  getAssemblyNames,
  getTrackConfigs,
  parseCommaSeparatedString,
  readConf,
  validatePrefixSize,
  writeConf,
} from './config-utils'
import { indexDriver } from './indexing-utils'
import { resolveConfigPath } from '../../utils'

import type { TextIndexFlags } from './index'

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
  const configPath = await resolveConfigPath(target, out)
  const outLocation = path.dirname(configPath)
  const config = readConf(configPath)
  ensureTrixDir(outLocation)

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
        quiet: quiet ?? false,
        name: asm,
        attributes: parseCommaSeparatedString(attributes),
        typesToExclude: parseCommaSeparatedString(exclude),
        assemblyNames: [asm],
        prefixSize: validatePrefixSize(prefixSize),
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
