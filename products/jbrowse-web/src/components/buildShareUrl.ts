import { shareSessionToDynamo } from '../sessionSharing.ts'
import { toUrlSafeB64 } from '../util.ts'

export interface ShareUrlResult {
  url: string
  sessionParam: string
  passwordParam: string
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

export async function buildLongShareUrl(snap: unknown): Promise<ShareUrlResult> {
  const sess = await toUrlSafeB64(JSON.stringify(snap))
  const sessionParam = `encoded-${sess}`
  const locationUrl = new URL(window.location.href)
  const params = new URLSearchParams(locationUrl.search)
  params.set('session', sessionParam)
  locationUrl.search = params.toString()
  return { url: locationUrl.toString(), sessionParam, passwordParam: '' }
}
