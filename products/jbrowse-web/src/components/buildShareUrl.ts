import { encodeSessionParam } from '@jbrowse/core/util'

import { readAllQueryParams } from '../useQueryParam.ts'

import type { SessionShareMode } from '@jbrowse/core/util'

// remembers the user's chosen share *mode* (short/long/json), not a URL
export const SHARE_MODE_LOCALSTORAGE_KEY = 'jbrowse-shareMode'

export interface ShareUrlResult {
  url: string
  sessionParam: string
  passwordParam: string
  // human-readable session text shown in the dialog instead of the URL (only
  // set for the plaintext json mode)
  plaintext?: string
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
    { shareURL, referer: locationUrl.href },
  )
  // carry over the page's existing params (e.g. config) from wherever they live
  // so none are lost when session is relocated, then write them all to one place
  const params = readAllQueryParams()
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
  return {
    url: locationUrl.href,
    sessionParam,
    passwordParam: password ?? '',
    plaintext,
  }
}
