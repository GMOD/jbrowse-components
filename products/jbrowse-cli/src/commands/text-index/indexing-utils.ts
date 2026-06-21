import path from 'path'
import { Readable } from 'stream'

import {
  generateMeta,
  guessAdapterFromFileName,
  indexFiles,
} from '@jbrowse/text-indexing-core'
import { Presets, SingleBar } from 'cli-progress'
import { ixIxxStream } from 'ixixx'

import { supported } from '../../types/common.ts'

import type { Track } from '@jbrowse/text-indexing-core'

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

  const ixPath = path.join(outLocation, 'trix', `${name}.ix`)
  const ixxPath = path.join(outLocation, 'trix', `${name}.ixx`)

  await ixIxxStream(readStream, ixPath, ixxPath, prefixSize)

  if (!quiet) {
    progressBar.update(1)
    progressBar.stop()
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
      tracks: trackConfigs,
      attributesToIndex: attributes,
      outDir: outLocation,
      featureTypesToExclude: typesToExclude,
      makeProgress: quiet
        ? undefined
        : trackId => {
            const progressBar = new SingleBar(
              {
                format: `{bar} ${trackId} {percentage}% | ETA: {eta}s`,
                etaBuffer: 2000,
              },
              Presets.shades_classic,
            )
            return {
              onStart: totalBytes => {
                progressBar.start(totalBytes, 0)
              },
              onUpdate: receivedBytes => {
                progressBar.update(receivedBytes)
              },
              onDone: () => {
                progressBar.stop()
              },
            }
          },
    }),
  )

  await runIxIxx({
    readStream,
    outLocation,
    name,
    prefixSize,
    quiet,
  })

  generateMeta({
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
