import {
  guessAdapterFromFileName,
  writeTrixIndex,
} from '@jbrowse/text-indexing-core'
import { Presets, SingleBar } from 'cli-progress'

import type { IndexingPolicy, Track } from '@jbrowse/text-indexing-core'

function bar(format: string) {
  return new SingleBar({ format, etaBuffer: 2000 }, Presets.shades_classic)
}

export async function indexDriver({
  trackConfigs,
  policy,
  outLocation,
  name,
  quiet,
  assemblyNames,
  prefixSize,
}: {
  trackConfigs: Track[]
  policy: IndexingPolicy
  outLocation: string
  name: string
  quiet: boolean
  assemblyNames: string[]
  prefixSize?: number
}): Promise<void> {
  let sortBar: SingleBar | undefined
  await writeTrixIndex({
    tracks: trackConfigs,
    outDir: outLocation,
    name,
    policy,
    assemblyNames,
    prefixSize,
    onSort: quiet
      ? undefined
      : () => {
          sortBar = bar('{bar} Sorting and writing index...')
          sortBar.start(1, 0)
        },
    makeProgress: quiet
      ? undefined
      : trackId => {
          const progressBar = bar(
            // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- {bar}/{percentage}/{eta} are cli-progress format tokens, not JS interpolation
            `{bar} ${trackId} {percentage}% | ETA: {eta}s`,
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
  })
  sortBar?.update(1)
  sortBar?.stop()
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
    return config
  })
}
