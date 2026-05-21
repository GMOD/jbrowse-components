import { adapterLocationKey } from '@jbrowse/text-indexing-core'

import { sanitizeNameForPath } from './config-utils.ts'

import type {
  LocalPathLocation,
  TrixTextSearchAdapter,
  UriLocation,
} from '../../base.ts'

export function getLoc(elt: UriLocation | LocalPathLocation): string {
  return elt.locationType === 'LocalPathLocation' ? elt.localPath : elt.uri
}

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

export function getAdapterLocation(
  adapter: { type?: string; [key: string]: unknown } | undefined,
): UriLocation | LocalPathLocation | undefined {
  const key = adapterLocationKey[adapter?.type ?? '']
  return key
    ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      ((adapter?.[key] as UriLocation | LocalPathLocation) ??
        (adapter as UriLocation | LocalPathLocation | undefined))
    : undefined
}
