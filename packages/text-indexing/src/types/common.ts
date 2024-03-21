import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import { LocalPathLocation, UriLocation, Track } from '../util'

// Method for handing off the parsing of a gff3 file URL.
// Calls the proper parser depending on if it is gzipped or not.
// Returns a @gmod/gff stream.
export async function createRemoteStream(urlIn: string) {
  const response = await fetch(urlIn)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${urlIn} status ${response.status} ${response.statusText}`,
    )
  }
  return response
}

// Checks if the passed in string is a valid URL.
// Returns a boolean.
export function isURL(FileName: string) {
  let url

  try {
    url = new URL(FileName)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

export async function getLocalOrRemoteStream(uri: string, out: string) {
  let stream
  let totalBytes = 0
  if (isURL(uri)) {
    const result = await createRemoteStream(uri)
    totalBytes = +(result.headers?.get('Content-Length') || 0)
    stream = result.body
  } else {
    const filename = path.isAbsolute(uri) ? uri : path.join(out, uri)
    totalBytes = fs.statSync(filename).size
    stream = fs.createReadStream(filename)
  }
  return { stream, totalBytes }
}

export function makeLocation(location: string, protocol: string) {
  if (protocol === 'uri') {
    return { locationType: 'UriLocation', uri: location } as UriLocation
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
      adapter: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: makeLocation(filePath, protocol),
      },
      assemblyNames: [],
      name: name,
      trackId: name,
    }
  } else if (/\.gff3?\.b?gz$/i.test(filePath)) {
    return {
      adapter: {
        gffGzLocation: makeLocation(filePath, protocol),
        type: 'Gff3TabixAdapter',
      },
      assemblyNames: [],
      name,
      trackId: name,
    }
  } else if (/\.gtf?$/i.test(filePath)) {
    return {
      adapter: {
        gtfLocation: makeLocation(filePath, protocol),
        type: 'GtfAdapter',
      },
      assemblyNames: [],
      name,
      trackId: name,
    }
  } else if (/\.vcf$/i.test(filePath)) {
    return {
      adapter: {
        type: 'VcfAdapter',
        vcfLocation: makeLocation(filePath, protocol),
      },
      assemblyNames: [],
      name,
      trackId: name,
    }
  } else if (/\.gff3?$/i.test(filePath)) {
    return {
      adapter: {
        gffLocation: makeLocation(filePath, protocol),
        type: 'Gff3Adapter',
      },
      assemblyNames: [],
      name,
      trackId: name,
    }
  } else {
    throw new Error(`Unsupported file type ${filePath}`)
  }
}

/**
 * Generates metadata of index given a filename (trackId or assembly)
 * @param name -  assembly name or trackId
 * @param attributes -  attributes indexed
 * @param include -  feature types included from index
 * @param exclude -  feature types excluded from index
 * @param configs - list of track
 */
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
      adapterConf: adapter,
      attributesIndexed: metaAttrs,
      excludedTypes: includeExclude,
      trackId: trackId,
    }
  })
  fs.writeFileSync(
    path.join(outDir, 'trix', `${name}_meta.json`),
    JSON.stringify(
      {
        assemblyNames,
        dateCreated: new Date().toISOString(),
        tracks,
      },
      null,
      2,
    ),
  )
}
