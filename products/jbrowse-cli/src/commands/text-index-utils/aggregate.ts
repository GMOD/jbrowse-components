import fs from 'fs'
import path from 'path'

import { getTrackConfigs, readConf, writeConf } from './config-utils'
import { indexDriver } from './indexing-utils'

import type { TrixTextSearchAdapter } from '../../base'

export async function aggregateIndex(flags: any) {
  const {
    out,
    target,
    tracks,
    assemblies,
    attributes,
    quiet,
    force,
    exclude,
    dryrun,
    prefixSize,
  } = flags
  const outFlag = target || out || '.'
  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confPath = isDir ? path.join(outFlag, 'config.json') : outFlag
  const outLocation = path.dirname(confPath)
  const config = readConf(confPath)

  const trixDir = path.join(outLocation, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }

  const aggregateTextSearchAdapters = config.aggregateTextSearchAdapters || []
  const asms =
    assemblies?.split(',') ||
    config.assemblies?.map(a => a.name) ||
    (config.assembly ? [config.assembly.name] : [])

  if (!asms.length) {
    throw new Error('No assemblies found')
  }

  for (const asm of asms) {
    const trackConfigs = getTrackConfigs(confPath, tracks?.split(','), asm)
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
        quiet,
        name: asm,
        attributes: attributes.split(','),
        typesToExclude: exclude.split(','),
        assemblyNames: [asm],
        prefixSize,
      })

      const trixConf = {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: id,
        ixFilePath: {
          uri: `trix/${asm}.ix`,
          locationType: 'UriLocation',
        },
        ixxFilePath: {
          uri: `trix/${asm}.ixx`,
          locationType: 'UriLocation',
        },
        metaFilePath: {
          uri: `trix/${asm}_meta.json`,
          locationType: 'UriLocation',
        },
        assemblyNames: [asm],
      } as TrixTextSearchAdapter

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
      confPath,
    )
  }
}
