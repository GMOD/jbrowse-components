import path from 'path'
import { Readable } from 'stream'

import {
  generateMeta,
  guessAdapterFromFileName,
  indexGff3,
  indexVcf,
} from '@jbrowse/text-indexing-core'
import { Presets, SingleBar } from 'cli-progress'
import { ixIxxStream } from 'ixixx'

import { getAdapterLocation, getLoc } from './adapter-utils.ts'
import { supported } from '../../types/common.ts'

import type { Track } from '../../base.ts'

export async function runIxIxx({
  readStream,
  outLocation,
  name,
  prefixSize,
  quiet,
}: {
  readStream: Readable
  outLocation: string
  name: string
  prefixSize?: number
  quiet?: boolean
}): Promise<void> {
  const progressBar = new SingleBar(
    { format: '{bar} Sorting and writing index...', etaBuffer: 2000 },
    Presets.shades_classic,
  )

  if (!quiet) {
    progressBar.start(1, 0)
  }

  await ixIxxStream(
    readStream,
    path.join(outLocation, 'trix', `${name}.ix`),
    path.join(outLocation, 'trix', `${name}.ixx`),
    prefixSize,
  )

  if (!quiet) {
    progressBar.update(1)
    progressBar.stop()
  }
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
    const { adapter, textSearching, trackId } = config
    const { type } = adapter || {}
    const {
      indexingFeatureTypesToExclude = typesToExclude,
      indexingAttributes = attributes,
    } = textSearching || {}

    const loc = getAdapterLocation(adapter)
    if (!loc) {
      continue
    }

    const progressBar = new SingleBar(
      {
        format: `{bar} ${trackId} {percentage}% | ETA: {eta}s`,
        etaBuffer: 2000,
      },
      Presets.shades_classic,
    )

    if (type === 'Gff3TabixAdapter' || type === 'Gff3Adapter') {
      yield* indexGff3({
        config,
        attributesToIndex: indexingAttributes,
        inLocation: getLoc(loc),
        outDir: outLocation,
        featureTypesToExclude: indexingFeatureTypesToExclude,
        onStart: totalBytes => {
          if (!quiet) {
            progressBar.start(totalBytes, 0)
          }
        },
        onUpdate: receivedBytes => {
          if (!quiet) {
            progressBar.update(receivedBytes)
          }
        },
      })
    } else if (type === 'VcfTabixAdapter' || type === 'VcfAdapter') {
      yield* indexVcf({
        config,
        attributesToIndex: indexingAttributes,
        inLocation: getLoc(loc),
        outDir: outLocation,
        onStart: totalBytes => {
          if (!quiet) {
            progressBar.start(totalBytes, 0)
          }
        },
        onUpdate: receivedBytes => {
          if (!quiet) {
            progressBar.update(receivedBytes)
          }
        },
      })
    }

    if (!quiet) {
      progressBar.stop()
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
  prefixSize?: number
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
    prefixSize,
    quiet,
  })

  await generateMeta({
    configs: trackConfigs,
    attributesToIndex: attributes,
    outDir: outLocation,
    name,
    featureTypesToExclude: typesToExclude,
    assemblyNames,
  })
}

export function prepareFileTrackConfigs(
  files: string[],
  fileIds?: string[],
): Track[] {
  return files
    .map((file, i) => {
      const config = guessAdapterFromFileName(file)
      if (fileIds?.[i]) {
        config.trackId = fileIds[i]!
      }
      return config
    })
    .filter(fileConfig => supported(fileConfig.adapter?.type))
}
