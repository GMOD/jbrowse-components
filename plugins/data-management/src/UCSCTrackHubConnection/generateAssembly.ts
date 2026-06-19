import { createElementId } from '@jbrowse/core/util/types/mst'

import { htmlLink, makeLocFromUri, resolve } from './util.ts'

import type { RaStanza } from '@gmod/ucsc-hub'

// build a JBrowse assembly config from a hub genome stanza, used both for
// single-file hubs (genome section of hub.txt) and multi-genome hubs (each
// stanza of genomes.txt). twoBit/chromSizes/chromAlias/html paths resolve
// against the base uri of the file the stanza came from (hub.txt for
// single-file, genomes.txt for multi-genome). chromSizes is optional since the
// TwoBitAdapter derives sizes from the .2bit when absent.
export function generateAssembly(genome: RaStanza, baseUri: string) {
  const { data, name } = genome
  return {
    name: name!,
    displayName: data.description,
    sequence: {
      type: 'ReferenceSequenceTrack',
      metadata: {
        ...data,
        ...(data.htmlPath
          ? { htmlPath: htmlLink(data.htmlPath, baseUri) }
          : {}),
      },
      trackId: `${name}-${createElementId()}`,
      adapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: makeLocFromUri(data.twoBitPath!, baseUri),
        ...(data.chromSizes
          ? { chromSizesLocation: makeLocFromUri(data.chromSizes, baseUri) }
          : {}),
      },
    },
    ...(data.chromAliasBb
      ? {
          refNameAliases: {
            adapter: {
              type: 'BigBedAdapter',
              uri: resolve(data.chromAliasBb, baseUri),
            },
          },
        }
      : {}),
  }
}
