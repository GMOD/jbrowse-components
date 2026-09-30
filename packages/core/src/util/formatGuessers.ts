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
 * creates a new location from the provided location including the appropriate
 * suffix and location type
 *
 * @param location - the FileLocation
 * @param suffix - the file suffix (e.g. .bam)
 * @returns the constructed location object from the provided parameters
 */
export function makeIndex(location: FileLocation, suffix: string) {
  if ('uri' in location) {
    return {
      uri: location.uri + suffix,
      locationType: 'UriLocation',
      // carry the parent's baseUri so a derived sibling index resolves against
      // the same config location as the file it indexes
      ...(location.baseUri ? { baseUri: location.baseUri } : {}),
    }
  } else if ('localPath' in location) {
    return {
      localPath: location.localPath + suffix,
      locationType: 'LocalPathLocation',
    }
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
