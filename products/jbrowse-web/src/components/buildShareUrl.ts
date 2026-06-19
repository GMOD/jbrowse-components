import { shareSessionToDynamo } from '../sessionSharing.ts'
import { toUrlSafeB64 } from '../util.ts'

export const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

export interface ShareUrlResult {
  url: string
  sessionParam: string
  passwordParam: string
  // human-readable session text shown in the dialog instead of the URL (only
  // set for the plaintext json mode)
  plaintext?: string
}

export async function buildShortShareUrl(
  snap: unknown,
  shareURL: string,
): Promise<ShareUrlResult> {
  const locationUrl = new URL(window.location.href)
  const result = await shareSessionToDynamo(snap, shareURL, locationUrl.href)
  const sessionParam = `share-${result.json.sessionId}`
  const passwordParam = result.password
  const params = new URLSearchParams(locationUrl.search)
  params.set('session', sessionParam)
  params.set('password', passwordParam)
  locationUrl.search = params.toString()
  return { url: locationUrl.href, sessionParam, passwordParam }
}

export async function buildLongShareUrl(
  snap: unknown,
): Promise<ShareUrlResult> {
  const sess = await toUrlSafeB64(JSON.stringify(snap))
  const sessionParam = `encoded-${sess}`
  const locationUrl = new URL(window.location.href)
  const params = new URLSearchParams(locationUrl.search)
  params.set('session', sessionParam)
  locationUrl.search = params.toString()
  return { url: locationUrl.toString(), sessionParam, passwordParam: '' }
}

// human-readable, uncompressed session embedded directly in the URL via the
// `json-` prefix (decoded by SessionLoader.decodeJsonUrlSession). Lets users
// inspect exactly what their session contains. The URL stores compact JSON; the
// dialog shows the pretty-printed `plaintext` so it's actually readable.
export function buildJsonShareUrl(snap: unknown): ShareUrlResult {
  const sessionParam = `json-${JSON.stringify({ session: snap })}`
  const locationUrl = new URL(window.location.href)
  const params = new URLSearchParams(locationUrl.search)
  params.set('session', sessionParam)
  locationUrl.search = params.toString()
  return {
    url: locationUrl.toString(),
    sessionParam,
    passwordParam: '',
    plaintext: JSON.stringify({ session: snap }, null, 2),
  }
}
