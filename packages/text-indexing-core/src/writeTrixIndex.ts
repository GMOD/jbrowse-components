import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import { ixIxxStream } from 'ixixx'

import { indexFiles } from './indexFiles.ts'
import { TRIX_DIR, trixFilePaths } from './trixPaths.ts'
import { trackIndexingPolicy } from './util.ts'

import type { TrackIndexProgress } from './indexFiles.ts'
import type { IndexingPolicy, Track } from './util.ts'

/**
 * Index `tracks` into `<outDir>/trix/<name>.ix`, `.ixx` and `_meta.json`.
 *
 * `onSort` fires once every file has been read, when the sort that writes the
 * index begins — minutes on a large index, with no byte count to report.
 */
export async function writeTrixIndex({
  tracks,
  outDir,
  name,
  policy,
  assemblyNames,
  prefixSize,
  makeProgress,
  checkAbort,
  onSort,
}: {
  tracks: Track[]
  outDir: string
  name: string
  policy: IndexingPolicy
  assemblyNames: string[]
  prefixSize?: number
  makeProgress?: (trackId: string) => TrackIndexProgress
  checkAbort?: () => void
  onSort?: () => void
}) {
  fs.mkdirSync(path.join(outDir, TRIX_DIR), { recursive: true })
  const records = Readable.from(
    indexFiles({ tracks, policy, outDir, makeProgress, checkAbort }),
  )
  if (onSort) {
    records.on('end', onSort)
  }
  const paths = trixFilePaths(outDir, name)
  await ixIxxStream(records, paths.ix, paths.ixx, prefixSize)
  checkAbort?.()
  fs.writeFileSync(
    paths.meta,
    JSON.stringify(
      {
        dateCreated: new Date().toISOString(),
        tracks: tracks.map(track => {
          const { attributes, exclude, include } = trackIndexingPolicy(
            track,
            policy,
          )
          return {
            trackId: track.trackId,
            attributesIndexed: attributes,
            excludedTypes: exclude,
            includedTypes: include,
            adapterConf: track.adapter,
          }
        }),
        assemblyNames,
      },
      null,
      2,
    ),
  )
}
