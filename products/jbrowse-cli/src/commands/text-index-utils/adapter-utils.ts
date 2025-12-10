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

export function getAdapterLocation(
  adapter: any,
): UriLocation | LocalPathLocation | undefined {
  const { type } = adapter || {}

  if (type === 'Gff3TabixAdapter') {
    return adapter.gffGzLocation || adapter
  } else if (type === 'Gff3Adapter') {
    return adapter.gffLocation || adapter
  } else if (type === 'VcfAdapter') {
    return adapter.vcfLocation || adapter
  } else if (type === 'VcfTabixAdapter') {
    return adapter.vcfGzLocation || adapter
  }

  return undefined
}
