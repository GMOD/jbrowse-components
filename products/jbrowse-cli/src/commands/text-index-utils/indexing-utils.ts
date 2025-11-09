import path from 'path'
import { Readable } from 'stream'

import { ixIxxStream } from 'ixixx'

import { getAdapterLocation, getLoc } from './adapter-utils'
import {
  generateMeta,
  guessAdapterFromFileName,
  supported,
} from '../../types/common'
import { indexGff3 } from '../../types/gff3Adapter'
import { indexVcf } from '../../types/vcfAdapter'

import type { Track } from '../../base'

export async function runIxIxx({
  readStream,
  outLocation,
  name,
  prefixSize,
}: {
  readStream: Readable
  outLocation: string
  name: string
  prefixSize?: number
}): Promise<void> {
  await ixIxxStream(
    readStream,
    path.join(outLocation, 'trix', `${name}.ix`),
    path.join(outLocation, 'trix', `${name}.ixx`),
    prefixSize,
  )
}

export async function* indexFiles({
  trackConfigs,
  attributes,
  outLocation,
  quiet,
  typesToExclude,
}: {
  trackConfigs: Track[]
  attributes: string[]
  outLocation: string
  quiet: boolean
  typesToExclude: string[]
}) {
  for (const config of trackConfigs) {
    const { adapter, textSearching } = config
    const { type } = adapter || {}
    const {
      indexingFeatureTypesToExclude = typesToExclude,
      indexingAttributes = attributes,
    } = textSearching || {}

    const loc = getAdapterLocation(adapter)
    if (!loc) {
      continue
    }

    if (type === 'Gff3TabixAdapter' || type === 'Gff3Adapter') {
      yield* indexGff3({
        config,
        attributesToIndex: indexingAttributes,
        inLocation: getLoc(loc),
        outLocation,
        typesToExclude: indexingFeatureTypesToExclude,
        quiet,
      })
    } else if (type === 'VcfTabixAdapter' || type === 'VcfAdapter') {
      yield* indexVcf({
        config,
        attributesToIndex: indexingAttributes,
        inLocation: getLoc(loc),
        outLocation,
        typesToExclude: indexingFeatureTypesToExclude,
        quiet,
      })
    }
  }
}

export async function indexDriver({
  trackConfigs,
  attributes,
  outLocation,
  name,
  quiet,
  typesToExclude,
  assemblyNames,
  prefixSize,
}: {
  trackConfigs: Track[]
  attributes: string[]
  outLocation: string
  name: string
  quiet: boolean
  typesToExclude: string[]
  assemblyNames: string[]
  prefixSize?: string | number
}): Promise<void> {
  const readStream = Readable.from(
    indexFiles({
      trackConfigs,
      attributes,
      outLocation,
      quiet,
      typesToExclude,
    }),
  )

  await runIxIxx({
    readStream,
    outLocation,
    name,
    prefixSize:
      typeof prefixSize === 'string' ? parseInt(prefixSize) : prefixSize,
  })

  await generateMeta({
    trackConfigs,
    attributes,
    outLocation,
    name,
    typesToExclude,
    assemblyNames,
  })
}

export function prepareFileTrackConfigs(
  files: string[],
  fileIds?: string[],
): Track[] {
  const trackConfigs = files
    .map(file => guessAdapterFromFileName(file))
    .filter(fileConfig => supported(fileConfig.adapter?.type))

  if (fileIds?.length) {
    for (const [i, element] of fileIds.entries()) {
      trackConfigs[i]!.trackId = element!
    }
  }

  return trackConfigs
}
