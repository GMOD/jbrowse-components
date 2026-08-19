import {
  matchFormat,
  resolveIndexType,
  trackTypeForAdapter,
} from '@jbrowse/add-track-core'

import { getFileName } from './getFileName.ts'
import { addAdapterGuesser, addTrackTypeGuesser, makeIndex } from './tracks.ts'

import type PluginManager from '../PluginManager.ts'
import type { AdapterConfig } from './tracks.ts'
import type { FileLocation } from './types/index.ts'
import type { AdapterSpec } from '@jbrowse/add-track-core'

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
 * Guess every format `@jbrowse/add-track-core`'s table describes — the same
 * table `@jbrowse/cli`'s `add-track` reads, so a file resolves to the same
 * adapter config in the app and on the command line.
 *
 * Whether a build can open a format is decided by `hasAdapterType`, not by the
 * table: guessing `BamAdapter` in a build with no alignments plugin would write
 * a track config that fails at render, and asking the registry is the only
 * statement of that which cannot go stale. A plugin therefore registers its
 * adapters and nothing else — there is no format list to keep in step.
 *
 * `CorePlugin` installs this first, so any `addAdapterGuesser` a plugin
 * registers is later in the chain and wins over the table. That is how a format
 * the table cannot express is added, and how a third-party plugin claims one.
 */
// #region installFormatGuessers
export function installFormatGuessers(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const spec = matchFormat(getFileName(file), adapterHint)?.spec
    return spec &&
      'adapterType' in spec &&
      pluginManager.hasAdapterType(spec.adapterType)
      ? adapterConfigFromSpec(spec, file, index)
      : undefined
  })
  addTrackTypeGuesser(pluginManager, (adapterName, file) =>
    pluginManager.hasAdapterType(adapterName)
      ? trackTypeForAdapter(adapterName, file && getFileName(file))
      : undefined,
  )
}
// #endregion
