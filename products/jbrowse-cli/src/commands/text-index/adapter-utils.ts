import { sanitizeNameForPath } from './config-utils'

import type {
  LocalPathLocation,
  TrixTextSearchAdapter,
  UriLocation,
} from '../../base'

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

const ADAPTER_LOCATION_KEYS: Record<string, string> = {
  Gff3TabixAdapter: 'gffGzLocation',
  Gff3Adapter: 'gffLocation',
  VcfAdapter: 'vcfLocation',
  VcfTabixAdapter: 'vcfGzLocation',
}

export function getAdapterLocation(
  adapter: { type?: string; [key: string]: unknown } | undefined,
): UriLocation | LocalPathLocation | undefined {
  const key = ADAPTER_LOCATION_KEYS[adapter?.type ?? '']
  return key
    ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      ((adapter?.[key] as UriLocation | LocalPathLocation) ??
        (adapter as UriLocation | LocalPathLocation | undefined))
    : undefined
}
