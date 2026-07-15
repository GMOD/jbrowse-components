import path from 'node:path'
import { Readable } from 'node:stream'

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
                // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- {bar}/{percentage}/{eta} are cli-progress format tokens, not JS interpolation
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
  return files.map((file, i) => {
    const config = guessAdapterFromFileName(file)
    if (fileIds?.[i]) {
      config.trackId = fileIds[i]!
    }
    // throw rather than silently filtering: a user who named the file with
    // --file should be told it can't be indexed (e.g. GTF) instead of getting
    // a misleading "successfully created index" with no output
    if (!supported(config.adapter?.type)) {
      throw new Error(
        `Cannot text-index ${file}: adapter type ${config.adapter?.type} is not indexable (only GFF3 and VCF are supported)`,
      )
    }
    return config
  })
}
