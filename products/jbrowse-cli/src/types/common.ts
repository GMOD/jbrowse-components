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

export async function generateMeta(
  asm: string,
  attributes: string[],
  include: string[],
  exclude: string[],
  confFile: string,
  configs: Track[],
) {
  const dir = path.dirname(confFile)

  const date_ob = new Date()
  const date = ('0' + date_ob.getDate()).slice(-2)
  const month = ('0' + (date_ob.getMonth() + 1)).slice(-2)
  const year = date_ob.getFullYear()
  const created = `${date}-${month}-${year}`

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
          ID: trackIds[x],
          attributesIndexed: metaAttrs[x],
          excludedTypes: includeExclude[x],
        }

        tracks.push(trackObj)
      }

      fs.writeFileSync(
        path.join(dir, 'trix', `${asm}_meta.json`),
        JSON.stringify({ dateCreated: { created }, tracks }, null, 2),
      )
    }
  }
}
