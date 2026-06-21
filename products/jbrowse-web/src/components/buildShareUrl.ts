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

// Builds a self-referential jbrowse-web URL (current page + `?session=`) for the
// chosen share mode. Session encoding is shared with desktop's export-to-web via
// encodeSessionParam, so only the URL assembly lives here.
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
  const params = new URLSearchParams(locationUrl.search)
  params.set('session', sessionParam)
  if (password) {
    params.set('password', password)
  }
  locationUrl.search = params.toString()
  return {
    url: locationUrl.href,
    sessionParam,
    passwordParam: password ?? '',
    plaintext,
  }
}
