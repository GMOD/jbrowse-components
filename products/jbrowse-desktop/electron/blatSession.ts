import { session } from 'electron'

/**
 * The cookie jar BLAT runs on.
 *
 * A BLAT query goes through the main process so the `cf_clearance` cookie a
 * solved Cloudflare challenge leaves behind attaches first-party — that is the
 * whole point of the route. On the *default* session that also meant every BLAT
 * POST, to whatever host the dialog's server field named, carried the app's
 * OAuth cookies. Its own partition keeps the half we want (a solve is still
 * visible to the request that needed it, because the challenge window and the
 * fetch share this jar) and drops the half we don't.
 *
 * `persist:` because a solved challenge is worth keeping across restarts, which
 * is what the default session gave us.
 */
export const BLAT_PARTITION = 'persist:jbrowse-blat'

export function blatSession() {
  return session.fromPartition(BLAT_PARTITION)
}

/**
 * Bounds a renderer-supplied BLAT url to what a BLAT server can be. The *host*
 * cannot be constrained — the dialog's server field is how someone runs their
 * own proxy or their own gfServer, and that is a feature — but the scheme can:
 * anything but http(s) is not a BLAT server, and embedded credentials would
 * make main send a Basic auth header the renderer chose.
 */
export function parseBlatUrl(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Not a valid BLAT server url: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`BLAT server url must be http or https: ${url}`)
  }
  if (parsed.username || parsed.password) {
    throw new Error('BLAT server url must not carry embedded credentials')
  }
  return parsed
}
