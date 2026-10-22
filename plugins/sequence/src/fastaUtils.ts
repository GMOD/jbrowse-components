import { openLocation } from '@jbrowse/core/util/io'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'

// the locations a FASTA `uri` shorthand implies, each index named as
// `samtools faidx` writes it beside the FASTA
export function deriveFastaLocations(
  { uri, baseUri }: Record<string, unknown>,
  indexes: readonly ('fai' | 'gzi')[],
) {
  return {
    fastaLocation: { uri, baseUri },
    ...Object.fromEntries(
      indexes.map(ext => [`${ext}Location`, { uri: `${uri}.${ext}`, baseUri }]),
    ),
  }
}

export function readOptionalMetadata(
  loc: FileLocation | undefined,
  pm: PluginManager | undefined,
) {
  return loc ? openLocation(loc, pm).readFile('utf8') : null
}
