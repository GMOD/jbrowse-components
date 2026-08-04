import { decodeSessionFromUrl, encodeSessionToUrl } from '@jbrowse/product-core'

import type { ViewModel } from './createModel.ts'

/**
 * Serialize the live session into a compact, URL-safe string suitable for a
 * query param or hash fragment — see the session-in-url example. The value
 * carries jbrowse-web's `encoded-` prefix, so a link built here also opens in
 * that app.
 */
export async function encodeSession(viewState: ViewModel): Promise<string> {
  const { session } = viewState
  if (!session) {
    throw new Error('no session to encode')
  }
  return encodeSessionToUrl(session)
}

/**
 * Inverse of {@link encodeSession}: decode a session string back into a
 * snapshot to hand to `createViewState`/`<JBrowse>`/`createApp` as `session`.
 * Accepts the value with or without the `encoded-` prefix.
 *
 * Throws on anything that isn't a decodable session, so a host can fall back to
 * its declarative `views` instead of opening a half-built session.
 */
export const decodeSession = decodeSessionFromUrl
