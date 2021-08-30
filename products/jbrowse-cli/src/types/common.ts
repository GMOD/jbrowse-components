import { IncomingMessage } from 'http'
import fs from 'fs'
import { http, https, FollowResponse } from 'follow-redirects'
import { Track } from '../base'
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

/**
 * Generates metadata of index given a filename (trackId or assembly)
 * @param name -  assembly name or trackId
 * @param attributes -  attributes indexed
 * @param include -  feature types included from index
 * @param exclude -  feature types excluded from index
 * @param confFile -  path to config file
 * @param configs - list of track
 */
export async function generateMeta(
  configs: Track[],
  attributes: string[],
  out: string,
  name: string,
  quiet: boolean,
  exclude: string[],
  confFile: string,
  assemblies: string[],
) {
  const dir = path.dirname(confFile)

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
    path.join(dir, 'trix', `${name}_meta.json`),
    JSON.stringify(
      {
        dateCreated: String(new Date()),
        tracks,
        assemblies,
      },
      null,
      2,
    ),
  )
}
