import { IncomingMessage } from 'http'
import fs from 'fs'
import { http, https, FollowResponse } from 'follow-redirects'
import {
  Track,
  PseudoTrack,
  GtfTabixAdapter,
  Gff3TabixAdapter,
  VcfTabixAdapter,
} from '../base'
import path from 'path'

// Method for handing off the parsing of a gff3 file URL.
// Calls the proper parser depending on if it is gzipped or not.
// Returns a @gmod/gff stream.
export async function createRemoteStream(urlIn: string) {
  const newUrl = new URL(urlIn)
  const fetcher = newUrl.protocol === 'https:' ? https : http

  return new Promise<IncomingMessage & FollowResponse>((resolve, reject) =>
    fetcher.get(urlIn, resolve).on('error', reject),
  )
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

function getFileName(uri: string) {
  return uri?.slice(uri.lastIndexOf('/') + 1)
}
export function guessAdapterFromFileName(filePath: string, outFlag: string) {
  const fileName = getFileName(filePath)
  let thePath = ''
  if (isURL(filePath)) {
    thePath = filePath
  } else {
    thePath = path.join(outFlag, filePath)
  }
  if (/\.vcf\.b?gz$/i.test(fileName)) {
    return {
      trackId: fileName,
      adapter: { type: 'VcfTabixAdapter', vcfGzLocation: { uri: thePath } },
    }
  } else if (/\.gff3?\.b?gz$/i.test(fileName)) {
    return {
      trackId: fileName,
      adapter: { type: 'Gff3TabixAdapter', gffGzLocation: { uri: thePath } },
    }
  } else if (/\.gtf?$/i.test(fileName)) {
    return {
      trackId: fileName,
      adapter: { type: 'GtfTabixAdapter', gffGzLocation: { uri: thePath } },
    }
  }
  return {
    adapter: { type: 'UNSUPPORTED' },
  }
}
export function supported(type: string) {
  return ['Gff3TabixAdapter', 'GtfTabixAdapter', 'VcfTabixAdapter'].includes(
    type,
  )
}
/**
 * Generates metadata of index given a filename (trackId or assembly)
 * @param name -  assembly name or trackId
 * @param attributes -  attributes indexed
 * @param include -  feature types included from index
 * @param exclude -  feature types excluded from index
 * @param confPath -  path to config file or root if not specified
 * @param configs - list of track
 */
export async function generateMeta(
  configs: Track[] | PseudoTrack[],
  attributes: string[],
  out: string,
  name: string,
  quiet: boolean,
  exclude: string[],
  confPath: string,
  assemblies: string[],
  files: string[] | undefined,
) {
  const dir = path.dirname(confPath)
  const tracks: {
    trackId: string
    adapter: Gff3TabixAdapter | GtfTabixAdapter | VcfTabixAdapter
    attributesIndexed: string[]
    excludedTypes: string[]
  }[] = []
  configs.forEach((config: Track | PseudoTrack) => {
    const { trackId, textSearching, adapter } = config

    const includeExclude =
      textSearching?.indexingFeatureTypesToExclude || exclude

    const metaAttrs = textSearching?.indexingAttributes || attributes
    tracks.push({
      trackId,
      adapter,
      attributesIndexed: metaAttrs,
      excludedTypes: includeExclude,
    })
    // return {
    //   trackId,
    //   adapter,
    //   attributesIndexed: metaAttrs,
    //   excludedTypes: includeExclude,
    // }
  })

  fs.writeFileSync(
    path.join(dir, 'trix', `${name}_meta.json`),
    JSON.stringify(
      {
        dateCreated: String(new Date()),
        tracks: files ? [] : tracks,
        assemblies,
        out,
        files: files ? files : [],
      },
      null,
      2,
    ),
  )
}
