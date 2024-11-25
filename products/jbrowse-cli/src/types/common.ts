import fs from 'fs'
import path from 'path'

// locals
import fetch from '../fetchWithProxy'
import type { Track, LocalPathLocation, UriLocation } from '../base'

export async function createRemoteStream(urlIn: string) {
  const res = await fetch(urlIn)
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${urlIn} status ${res.status} ${await res.text()}`,
    )
  }
  return res
}

export function isURL(FileName: string) {
  let url: URL | undefined

  try {
    url = new URL(FileName)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

function makeLocation(location: string, protocol: string) {
  if (protocol === 'uri') {
    return {
      uri: location,
      locationType: 'UriLocation',
    } as UriLocation
  }
  if (protocol === 'localPath') {
    return {
      localPath: path.resolve(location),
      locationType: 'LocalPathLocation',
    } as LocalPathLocation
  }
  throw new Error(`invalid protocol ${protocol}`)
}

export function guessAdapterFromFileName(filePath: string): Track {
  const protocol = isURL(filePath) ? 'uri' : 'localPath'
  const name = path.basename(filePath)
  if (/\.vcf\.b?gz$/i.test(filePath)) {
    return {
      trackId: name,
      name: name,
      assemblyNames: [],
      adapter: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gff3?\.b?gz$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gtf?$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'GtfAdapter',
        gtfLocation: { uri: filePath, locationType: 'UriLocation' },
      },
    }
  } else if (/\.vcf$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'VcfAdapter',
        vcfLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gff3?$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'Gff3Adapter',
        gffLocation: makeLocation(filePath, protocol),
      },
    }
  } else {
    throw new Error(`Unsupported file type ${filePath}`)
  }
}

export function supported(type = '') {
  return [
    'Gff3TabixAdapter',
    'VcfTabixAdapter',
    'Gff3Adapter',
    'VcfAdapter',
  ].includes(type)
}

export async function generateMeta({
  trackConfigs,
  attributes,
  outLocation,
  name,
  typesToExclude,
  assemblyNames,
}: {
  trackConfigs: Track[]
  attributes: string[]
  outLocation: string
  name: string
  typesToExclude: string[]
  assemblyNames: string[]
}) {
  const tracks = trackConfigs.map(({ adapter, textSearching, trackId }) => ({
    trackId,
    attributesIndexed: textSearching?.indexingAttributes || attributes,
    excludedTypes:
      textSearching?.indexingFeatureTypesToExclude || typesToExclude,
    adapterConf: adapter,
  }))

  fs.writeFileSync(
    path.join(outLocation, 'trix', `${name}_meta.json`),
    JSON.stringify(
      {
        dateCreated: new Date().toISOString(),
        tracks,
        assemblyNames,
      },
      null,
      2,
    ),
  )
}
