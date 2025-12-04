import type {
  LocalPathLocation,
  TrixTextSearchAdapter,
  UriLocation,
} from '../../base'

export function getLoc(elt: UriLocation | LocalPathLocation): string {
  return elt.locationType === 'LocalPathLocation' ? elt.localPath : elt.uri
}

export function createTrixAdapter(
  id: string,
  asm: string,
  assemblyNames?: string[],
): TrixTextSearchAdapter {
  return {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: id,
    ixFilePath: {
      uri: `trix/${asm}.ix`,
      locationType: 'UriLocation',
    },
    ixxFilePath: {
      uri: `trix/${asm}.ixx`,
      locationType: 'UriLocation',
    },
    metaFilePath: {
      uri: `trix/${asm}_meta.json`,
      locationType: 'UriLocation',
    },
    assemblyNames: assemblyNames || [asm],
  }
}

export function createPerTrackTrixAdapter(
  trackId: string,
  assemblyNames: string[],
) {
  return {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: `${trackId}-index`,
    ixFilePath: {
      uri: `trix/${trackId}.ix`,
      locationType: 'UriLocation' as const,
    },
    ixxFilePath: {
      uri: `trix/${trackId}.ixx`,
      locationType: 'UriLocation' as const,
    },
    metaFilePath: {
      uri: `trix/${trackId}_meta.json`,
      locationType: 'UriLocation' as const,
    },
    assemblyNames: assemblyNames,
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
