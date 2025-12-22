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
  return {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: `${name}-${idSuffix}`,
    ixFilePath: {
      uri: `trix/${name}.ix`,
      locationType: 'UriLocation',
    },
    ixxFilePath: {
      uri: `trix/${name}.ixx`,
      locationType: 'UriLocation',
    },
    metaFilePath: {
      uri: `trix/${name}_meta.json`,
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
  adapter: any,
): UriLocation | LocalPathLocation | undefined {
  const key = ADAPTER_LOCATION_KEYS[adapter?.type]
  return key ? (adapter[key] ?? adapter) : undefined
}
