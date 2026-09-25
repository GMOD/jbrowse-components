import { readAllQueryParams } from '@jbrowse/app-core'
import { encodeSessionParam } from '@jbrowse/core/util'

import type { SessionShareMode } from '@jbrowse/core/util'

// Page params a shared link never carries:
// - `adminKey`/`adminServer`: adminKey is the credential the admin server
//   accepts for overwriting config.json, and both survive
//   stripConsumedSessionParams because an admin needs them across reloads
// - `safeMode`: sticks across reloads on purpose (it is how a user gets back to
//   a menu a crashing permanent plugin hid), which is exactly what would make it
//   silently switch off the recipient's plugins
// - `session`/`password`: this page's own session, replaced by the shared one
const PAGE_ONLY_PARAMS = [
  'adminKey',
  'adminServer',
  'safeMode',
  'session',
  'password',
]

export interface ShareUrlResult {
  url: string
  // the indented session the dialog shows beside the URL, json mode only
  plaintext?: string
}

// Builds a link to this jbrowse-web page carrying `snap`. Session encoding is
// shared with desktop's export-to-web via encodeSessionParam, so only the URL
// assembly lives here.
//
// Every mode puts its params in the hash fragment, which a browser never sends
// to a server: an inline session there can't trip the request-line limit
// (HTTP 414), and a short link's decryption key can't land in the access log of
// whatever serves the page.
export async function buildShareUrl(
  mode: SessionShareMode,
  snap: unknown,
  shareURL: string,
  pageUrl: string,
): Promise<ShareUrlResult> {
  const url = new URL(pageUrl)
  const params = readAllQueryParams(url)
  for (const key of PAGE_ONLY_PARAMS) {
    params.delete(key)
  }
  // POSTed to the share server and stored beside the session, so it carries
  // what the link carries and no session
  const referer = new URL(url)
  referer.search = params.toString()
  referer.hash = ''
  const { sessionParam, password, plaintext } = await encodeSessionParam(
    mode,
    snap,
    { shareURL, referer: referer.href },
  )
  params.set('session', sessionParam)
  if (password) {
    params.set('password', password)
  }
  url.search = ''
  url.hash = params.toString()
  return { url: url.href, plaintext }
}
