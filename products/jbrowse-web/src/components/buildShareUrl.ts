import { encodeSessionParam } from '@jbrowse/core/util'

import type { SessionShareMode } from '@jbrowse/core/util'

export const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

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
  const inline = mode !== 'short'
  const params = new URLSearchParams(inline ? '' : locationUrl.search)
  params.set('session', sessionParam)
  if (password) {
    params.set('password', password)
  }
  const str = params.toString()
  if (inline) {
    locationUrl.hash = str
  } else {
    locationUrl.search = str
  }
  return {
    url: locationUrl.href,
    sessionParam,
    passwordParam: password ?? '',
    plaintext,
  }
}
