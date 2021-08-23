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
  include: string[],
  exclude: string[],
  confFile: string,
  assemblies: string[],
) {
  const dir = path.dirname(confFile)

  const metaAttrs: Array<string[]> = []
  const trackIds: Array<string> = []
  const includeExclude: Array<string[]> = []

  for (const config of configs) {
    const tracks = []
    const { textSearchConf } = config
    if (configs.length) {
      includeExclude.push(
        textSearchConf?.indexingFeatureTypesToExclude || ['CDS', 'exon'],
      )

      for (const inc of include) {
        const index = includeExclude[0].indexOf(inc)
        if (index > -1) {
          includeExclude[0].splice(index, 1)
        }
      }
      for (const exc of exclude) {
        if (exc.length > 0 && includeExclude[0].indexOf(exc) === -1) {
          includeExclude[0].push(exc)
        }
      }

      if (attributes && attributes.length > 0) {
        metaAttrs.push(attributes)
      } else if (textSearchConf?.indexingAttributes) {
        metaAttrs.push(textSearchConf?.indexingAttributes)
      } else {
        metaAttrs.push(['Name', 'ID'])
      }
      trackIds.push(config.trackId)

      for (const x in trackIds) {
        const trackObj = {
          trackId: trackIds[x],
          attributesIndexed: metaAttrs[x],
          excludedTypes: includeExclude[x],
        }

        tracks.push(trackObj)
      }

      fs.writeFileSync(
        path.join(dir, 'trix', `${name}_meta.json`),
        JSON.stringify(
          {
            dateCreated: new Date().toLocaleString('en-US'),
            tracks,
            assemblies,
          },
          null,
          2,
        ),
      )
    }
  }
}
