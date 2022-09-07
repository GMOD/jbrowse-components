import fs from 'fs'
import { Track, LocalPathLocation, UriLocation } from '../base'
import path from 'path'
import fetch from '../fetchWithProxy'

export async function createRemoteStream(urlIn: string) {
  const response = await fetch(urlIn)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${urlIn} status ${response.status} ${response.statusText}`,
    )
  }
  return response
}

export function isURL(FileName: string) {
  let url

  try {
    url = new URL(FileName)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

function makeLocation(location: string, protocol: string) {
  if (protocol === 'uri') {
    return { uri: location, locationType: 'UriLocation' } as UriLocation
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
  // const uri = isURL(filePath) ? filePath : path.resolve(filePath)
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

export function supported(type: string) {
  return [
    'Gff3TabixAdapter',
    'VcfTabixAdapter',
    'Gff3Adapter',
    'VcfAdapter',
  ].includes(type)
}

export async function generateMeta({
  configs,
  attributes,
  outDir,
  name,
  exclude,
  assemblyNames,
}: {
  configs: Track[]
  attributes: string[]
  outDir: string
  name: string
  exclude: string[]
  assemblyNames: string[]
}) {
  const tracks = configs.map(config => {
    const { trackId, textSearching, adapter } = config

    const includeExclude =
      textSearching?.indexingFeatureTypesToExclude || exclude

    const metaAttrs = textSearching?.indexingAttributes || attributes

    return {
      trackId: trackId,
      attributesIndexed: metaAttrs,
      excludedTypes: includeExclude,
      adapterConf: adapter,
    }
  })
  fs.writeFileSync(
    path.join(outDir, 'trix', `${name}_meta.json`),
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
