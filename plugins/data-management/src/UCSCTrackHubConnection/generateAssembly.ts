import { createElementId } from '@jbrowse/core/util/types/mst'

import { resolve } from './util.ts'

import type { RaStanza } from '@gmod/ucsc-hub'

// build a JBrowse assembly config from a single-file hub's genome stanza,
// resolving the twoBit/chromSizes/chromAlias/html paths against the hub uri
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
          ? {
              htmlPath: `<a href="${resolve(data.htmlPath, baseUri)}">${data.htmlPath}</a>`,
            }
          : {}),
      },
      trackId: `${name}-${createElementId()}`,
      adapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: {
          uri: resolve(data.twoBitPath!, baseUri),
        },
        chromSizesLocation: {
          uri: resolve(data.chromSizes!, baseUri),
        },
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
