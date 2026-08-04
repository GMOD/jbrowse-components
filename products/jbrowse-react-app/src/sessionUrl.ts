import { fromUrlSafeB64, toUrlSafeB64 } from '@jbrowse/core/util'
import { getShareableSessionSnapshot } from '@jbrowse/product-core'

import type { ViewModel } from './createModel.ts'
import type { SessionSnapshot } from './types.ts'

// The prefix jbrowse-web's SessionLoader uses for an inline compressed session
// (`?session=encoded-…`). Emitting it means a link built from an embedded app
// can be pasted into jbrowse.org/jb2 and vice versa, so hosts get one format
// rather than a private one. decodeSession tolerates its absence.
const ENCODED_PREFIX = 'encoded-'

/**
 * Serialize the live session into a compact, URL-safe string suitable for a
 * query param or hash fragment. Deflated then base64url-encoded, so it survives
 * a URL intact and stays far smaller than raw JSON.
 *
 * This is not a plain `getSnapshot`. Display settings a user is *inheriting*
 * from a promoted display-type default live in their own browser, never in the
 * session, so a raw snapshot renders differently for whoever opens the link;
 * `getShareableSessionSnapshot` flattens that cascade into the snapshot first.
 *
 * The session travels but the config does not — the receiving app supplies its
 * own `assemblies`/`tracks`. Put the session somewhere the server never sees
 * (the hash fragment) if it may be long: a query string can exceed the request
 * line limit and get a 414, which is why jbrowse-web moved its own there.
 */
export async function encodeSession(viewState: ViewModel): Promise<string> {
  const { session } = viewState
  if (!session) {
    throw new Error('no session to encode')
  }
  const snap = getShareableSessionSnapshot(session)
  return `${ENCODED_PREFIX}${await toUrlSafeB64(JSON.stringify(snap))}`
}

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'name' in value &&
    typeof value.name === 'string'
  )
}

/**
 * Inverse of {@link encodeSession}: decode a session string back into a
 * snapshot to hand to `createViewState`/`<JBrowse>`/`createApp` as `session`.
 * Accepts the value with or without the `encoded-` prefix, so a raw
 * `?session=` value from either app can be passed straight through.
 *
 * Throws on anything that isn't a decodable session — a truncated link, a
 * `share-`/`spec-` param this app doesn't handle — so a host can fall back to
 * its declarative `views` instead of opening a half-built session.
 */
export async function decodeSession(encoded: string): Promise<SessionSnapshot> {
  const b64 = encoded.startsWith(ENCODED_PREFIX)
    ? encoded.slice(ENCODED_PREFIX.length)
    : encoded
  const parsed: unknown = JSON.parse(await fromUrlSafeB64(b64))
  if (!isSessionSnapshot(parsed)) {
    throw new Error('not a session snapshot: no "name"')
  }
  return parsed
}
