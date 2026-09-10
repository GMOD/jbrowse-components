import {
  decodeSessionFromUrl,
  encodeSessionToUrl,
  getSessionSnapshot as sessionSnapshotOf,
} from '@jbrowse/product-core'

import type { ViewModel } from './createModel.ts'
import type { SessionSnapshot } from './types.ts'

/**
 * Serialize the live session into a compact, URL-safe string suitable for a
 * query param or hash fragment — see the session-in-url example. The value
 * carries jbrowse-web's `encoded-` prefix, so a link built here also opens in
 * that app.
 */
export async function encodeSession(viewState: ViewModel): Promise<string> {
  return encodeSessionToUrl(viewState.session)
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

/**
 * The live session as a plain JSON snapshot, ready to hand straight back as
 * `createApp`'s `session` (or `setSession`). The uncompressed twin of
 * {@link encodeSession}, for hosts that move JSON rather than URLs — a notebook
 * kernel, an R session, a "save this layout" button.
 *
 * Like `encodeSession`, this goes through product-core's shareable snapshot
 * rather than a plain `getSnapshot`, so what a reader gets is the same outgoing
 * shape every product hands out.
 */
export function getSessionSnapshot(viewState: ViewModel): SessionSnapshot {
  return sessionSnapshotOf(viewState.session)
}
