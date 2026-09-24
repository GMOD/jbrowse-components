import { trixFileUris } from '@jbrowse/text-indexing-core'

import type { SearchIndexEntry, TrixTextSearchAdapter } from '../../base.ts'

export function createTrixAdapter(
  name: string,
  assemblyNames: string[],
): TrixTextSearchAdapter {
  const uris = trixFileUris(name)
  return {
    type: 'TrixTextSearchAdapter',
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

// an aggregate entry is the index its files are, so a re-index of the same
// assembly finds the entry pointing at them however it was written, `.ix`
// string and `{ uri }` included; an entry with no trix file, a JBrowse 1
// index, is only ever itself
export function indexFileOf(entry: SearchIndexEntry) {
  if (typeof entry === 'string') {
    return entry
  }
  const { ixFilePath, uri } = entry
  return ixFilePath
    ? 'uri' in ixFilePath
      ? ixFilePath.uri
      : ixFilePath.localPath
    : (uri ?? entry)
}
