import { sanitizeForFilename, trixFileUris } from '@jbrowse/text-indexing-core'

import type { TrixTextSearchAdapter } from '../../base.ts'

export function createTrixAdapter(
  name: string,
  assemblyNames: string[],
  idSuffix = 'index',
): TrixTextSearchAdapter {
  const uris = trixFileUris(name)
  return {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: `${sanitizeForFilename(name)}-${idSuffix}`,
    ixFilePath: {
      uri: uris.ix,
      locationType: 'UriLocation',
    },
    ixxFilePath: {
      uri: uris.ixx,
      locationType: 'UriLocation',
    },
    assemblyNames,
  }
}
