import { sanitizeNameForPath } from './config-utils.ts'

import type { TrixTextSearchAdapter } from '../../base.ts'

export function createTrixAdapter(
  name: string,
  assemblyNames: string[],
  idSuffix = 'index',
): TrixTextSearchAdapter {
  const safeName = sanitizeNameForPath(name)
  return {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: `${safeName}-${idSuffix}`,
    ixFilePath: {
      uri: `trix/${safeName}.ix`,
      locationType: 'UriLocation',
    },
    ixxFilePath: {
      uri: `trix/${safeName}.ixx`,
      locationType: 'UriLocation',
    },
    metaFilePath: {
      uri: `trix/${safeName}_meta.json`,
      locationType: 'UriLocation',
    },
    assemblyNames,
  }
}
