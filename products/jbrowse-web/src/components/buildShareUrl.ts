import { readAllQueryParams } from '@jbrowse/app-core'
import { encodeSessionParam } from '@jbrowse/core/util'

import type { SessionShareMode } from '@jbrowse/core/util'

// remembers the user's chosen share *mode* (short/long/json), not a URL
export const SHARE_MODE_LOCALSTORAGE_KEY = 'jbrowse-shareMode'

// never carried into a shared link, nor into the referer reported to the share
// server — see buildShareUrl and refererFor
const ADMIN_PARAMS = ['adminKey', 'adminServer']

// Params that describe this browser's state rather than the session, and so
// stop at the address bar. `safeMode` sticks across reloads on purpose (it is
// how a user gets back to a menu a crashing permanent plugin hid), which is
// exactly what would make it silently switch off the recipient's plugins.
const LOCAL_PARAMS = ['safeMode']

export interface ShareUrlResult {
  url: string
  // human-readable session text shown in the dialog alongside the URL (only
  // set for the plaintext json mode)
  plaintext?: string
}

// The page URL as it is reported to the share server. Everything the shared
// link itself is careful not to carry has to come off here too — this string is
// POSTed to a third-party service and stored next to the session:
//
// - the admin params, for the same reason as below (adminKey is the credential
//   the admin server accepts for overwriting config.json)
// - `password`, which would be a previous short link's decryption key
// - the whole hash fragment, which is where an inline `encoded-`/`json-`
//   session lives. Browsers never send a fragment to a server; uploading one in
//   a form field would hand over the very session the short mode encrypts.
function refererFor(locationUrl: URL) {
  const url = new URL(locationUrl.href)
  url.hash = ''
  for (const key of [...ADMIN_PARAMS, 'password']) {
    url.searchParams.delete(key)
  }
  return url.href
}

// Builds a self-referential jbrowse-web URL for the chosen share mode. Session
// encoding is shared with desktop's export-to-web via encodeSessionParam, so
// only the URL assembly lives here.
//
// The large inline modes (`encoded-`/`json-`) go in the hash fragment, which is
// never sent to the server and so can't trip the request-line limit (HTTP 414)
// the query string can; the tiny `share-<id>` short link stays in the query
// string. The SessionLoader reads `session=` from either location.
export async function buildShareUrl(
  mode: SessionShareMode,
  snap: unknown,
  shareURL: string,
): Promise<ShareUrlResult> {
  const locationUrl = new URL(window.location.href)
  const { sessionParam, password, plaintext } = await encodeSessionParam(
    mode,
    snap,
    { shareURL, referer: refererFor(locationUrl) },
  )
  // carry over the page's existing params (e.g. config) from wherever they live
  // so none are lost when session is relocated, then write them all to one place
  const params = readAllQueryParams()
  // ...except the admin ones. They survive stripConsumedSessionParams (an admin
  // needs them across reloads), so they are still in the address bar when the
  // share dialog reads it — and adminKey is the credential the admin server
  // accepts for overwriting config.json. Sharing a link must never hand that to
  // the recipient.
  for (const key of [...ADMIN_PARAMS, ...LOCAL_PARAMS]) {
    params.delete(key)
  }
  params.set('session', sessionParam)
  if (password) {
    params.set('password', password)
  } else {
    // drop a stale password carried over from a prior short link — the inline
    // long/json modes don't use one, and it would leak the old link's password
    params.delete('password')
  }
  const str = params.toString()
  if (mode === 'short') {
    locationUrl.search = str
    locationUrl.hash = ''
  } else {
    locationUrl.search = ''
    locationUrl.hash = str
  }
  return { url: locationUrl.href, plaintext }
}
