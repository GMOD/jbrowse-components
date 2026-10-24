import { readAllQueryParams } from '@jbrowse/app-core'
import { encodeSessionParam } from '@jbrowse/core/util'

import type { SessionShareMode } from '@jbrowse/core/util'

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
): Promise<string> {
  const url = new URL(pageUrl)
  // The link names the config and the session, and nothing else of this page's:
  // the rest are this browser's own (adminKey is the admin server's credential,
  // safeMode and renderer work around this machine's plugins and GPU)
  const config = readAllQueryParams(url).get('config')
  const params = new URLSearchParams(config === null ? {} : { config })
  // POSTed to the share server and stored beside the session, so it carries
  // what the link carries and no session
  const referer = new URL(url)
  referer.search = params.toString()
  referer.hash = ''
  const { sessionParam, password } = await encodeSessionParam(mode, snap, {
    shareURL,
    referer: referer.href,
  })
  params.set('session', sessionParam)
  if (password) {
    params.set('password', password)
  }
  url.search = ''
  url.hash = params.toString()
  return url.href
}
