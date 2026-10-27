import {
  matchFormat,
  resolveIndexType,
  trackTypeForAdapter,
} from '@jbrowse/add-track-core'

import { getFileName } from './getFileName.ts'

import type { AdapterConfig } from './tracks.ts'
import type { FileLocation } from './types/data.ts'
import type { AdapterSpec } from '@jbrowse/add-track-core'

/**
 * `location` with `suffix` appended to its file: the sibling index of a URI
 * or local path, keeping the parent's `baseUri` and internet account. A Blob
 * or FileHandle has no sibling, so it comes back unchanged.
 */
export function makeIndex(location: FileLocation, suffix: string) {
  if ('uri' in location) {
    return { ...location, uri: location.uri + suffix }
  } else if ('localPath' in location) {
    return { ...location, localPath: location.localPath + suffix }
  } else {
    return location
  }
}

/**
 * The adapter config one format-table entry describes: the data file under the
 * field that format's adapter reads it from, plus wherever that adapter expects
 * its index — nested under `index` for BAM and the tabix formats, a top-level
 * sidecar field for CRAM and FASTA.
 *
 * `index` is the location the caller was handed (the "index file" field of the
 * add-track form); every sidecar the caller did not name is derived from the
 * data file's own location.
 */
export function adapterConfigFromSpec(
  spec: AdapterSpec,
  file: FileLocation,
  index?: FileLocation,
): AdapterConfig | undefined {
  switch (spec.kind) {
    case 'single':
    case 'anchors':
      return { type: spec.adapterType, [spec.locField]: file }
    case 'indexed':
      return {
        type: spec.adapterType,
        [spec.locField]: file,
        index: {
          location: index ?? makeIndex(file, spec.suffix),
          indexType: resolveIndexType(
            index && getFileName(index),
            spec.indexType,
          ),
        },
      }
    case 'sidecar':
      return {
        type: spec.adapterType,
        [spec.locField]: file,
        ...Object.fromEntries(
          spec.sidecars.map(s => [
            s.field,
            s.fromIndex && index ? index : makeIndex(file, s.suffix),
          ]),
        ),
      }
    case 'unsupported':
      return undefined
  }
}

/**
 * The track the format table makes of a file: its adapter, the track type that
 * draws it, and the file name as its name. `undefined` for a file no format
 * claims, which is where `guessTrackConf` throws.
 */
export function guessTrackConfFromTable(
  file: FileLocation,
  index?: FileLocation,
  adapterHint?: string,
) {
  const name = getFileName(file)
  const spec = matchFormat(name, adapterHint)?.spec
  const adapter = spec && adapterConfigFromSpec(spec, file, index)
  return adapter
    ? {
        type: trackTypeForAdapter(adapter.type, name) ?? 'FeatureTrack',
        name,
        adapter,
      }
    : undefined
}
