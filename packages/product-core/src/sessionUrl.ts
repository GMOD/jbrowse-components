import {
  ENCODED_PREFIX,
  JSON_PREFIX,
  fromUrlSafeB64,
  toUrlSafeB64,
} from '@jbrowse/core/util'

import { getShareableSessionSnapshot } from './Session/shareableSnapshot.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * A serialized session. Open-shaped on purpose: the concrete shape is the
 * session model's `SnapshotIn`, which grows with every plugin a host loads.
 */
export interface SessionSnapshot {
  name: string
  [key: string]: unknown
}

/**
 * Serialize a live session into a compact, URL-safe string for a query param or
 * hash fragment. Deflated then base64url-encoded, so it survives a URL intact
 * and stays far smaller than raw JSON.
 *
 * Not a plain `getSnapshot`: a workspace arrangement turned on by the sender's
 * preference is not in the snapshot, so a raw one renders as a classic stack
 * for whoever opens the link. `getShareableSessionSnapshot` stamps it first.
 *
 * The session travels but the config does not — the receiving app supplies its
 * own assembly/tracks. Put the result somewhere the server never sees (the hash
 * fragment) if it may be long: a query string can exceed the request-line limit
 * and get a 414, which is why jbrowse-web moved its own there.
 *
 * Carries `ENCODED_PREFIX`, the same `?session=encoded-…` value jbrowse-web's
 * SessionLoader decodes, so a link built by an embedded product opens in
 * jbrowse.org/jb2 and vice versa. The format is `encodeSessionParam`'s `long`
 * mode; sessionUrl.test.ts asserts the two stay byte-identical.
 */
export async function encodeSessionToUrl(
  session: AbstractSessionModel,
): Promise<string> {
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

// A clipped `json-` link still parses up to the cut, so without this the
// recipient reads JSON.parse's "Unterminated string in JSON at position 813"
function parseJsonParam(json: string): unknown {
  try {
    return (JSON.parse(json) as { session?: unknown } | null)?.session
  } catch (e) {
    throw new Error(
      "This link's session JSON is incomplete, which is how a link cut short in transit arrives. A short link survives being sent where a long one may not.",
      { cause: e },
    )
  }
}

async function parseEncodedParam(value: string): Promise<unknown> {
  return JSON.parse(
    await fromUrlSafeB64(
      value.startsWith(ENCODED_PREFIX)
        ? value.slice(ENCODED_PREFIX.length)
        : value,
    ),
  )
}

/**
 * Inverse of {@link encodeSessionToUrl}, and of the `json-` form jbrowse-web's
 * share dialog writes. Accepts an `encoded-` value with or without its prefix,
 * so a raw `?session=` value from either app passes straight through.
 *
 * Throws on anything that isn't a decodable session — a truncated link, or a
 * `share-`/`spec-` param an embedded product doesn't handle — so a host can
 * fall back to its own declarative launch state instead of opening a
 * half-built session.
 */
export async function decodeSessionFromUrl(
  value: string,
): Promise<SessionSnapshot> {
  const parsed = value.startsWith(JSON_PREFIX)
    ? parseJsonParam(value.slice(JSON_PREFIX.length))
    : await parseEncodedParam(value)
  if (!isSessionSnapshot(parsed)) {
    throw new Error('not a session snapshot: no "name"')
  }
  return parsed
}
