import fs from 'fs'
import { Track } from '../base'
import fetch from 'node-fetch'
import path from 'path'

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

export function guessAdapterFromFileName(filePath: string): Track {
  const uri = isURL(filePath) ? filePath : path.resolve(filePath)
  const name = path.basename(uri)
  if (/\.vcf\.b?gz$/i.test(filePath)) {
    return {
      trackId: name,
      name: name,
      assemblyNames: [],
      adapter: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: { uri, locationType: 'UriLocation' },
      },
    }
  } else if (/\.gff3?\.b?gz$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: { uri, locationType: 'UriLocation' },
      },
    }
  } else if (/\.gtf?$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'GtfAdapter',
        gtfLocation: { uri, locationType: 'UriLocation' },
      },
    }
  } else {
    throw new Error(`Unsupported file type ${filePath}`)
  }
}

export function supported(type: string) {
  return ['Gff3TabixAdapter', 'VcfTabixAdapter'].includes(type)
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
