import { decodeSessionFromUrl, encodeSessionToUrl } from '@jbrowse/product-core'

import type { ViewModel } from './createModel/createModel.ts'

/**
 * Serialize the live session into a compact, URL-safe string suitable for a
 * query param or hash fragment — see the session-in-url example. The value
 * carries jbrowse-web's `encoded-` prefix, so the same string is also what that
 * app's `?session=` accepts.
 *
 * Where `getSnapshot(viewState.session)` gives you the session to store,
 * this gives you the session to *put in a link*: compressed for the URL, and
 * self-contained for a reader who doesn't share your local settings.
 */
export async function encodeSession(viewState: ViewModel): Promise<string> {
  return encodeSessionToUrl(viewState.session)
}

/**
 * Inverse of {@link encodeSession}: decode a session string back into a
 * snapshot to hand to `createViewState` as **`session`** (or to the
 * controller's `setSession`), not `defaultSession` — that slot is the
 * compiler-checked shape for a session you author in TypeScript, and a decoded
 * one is only known at runtime, so it goes through the door that validates it
 * as MST applies it. Accepts the value with or without the `encoded-` prefix.
 *
 * Throws on anything that isn't a decodable session, so a host can fall back to
 * its normal launch state instead of opening a half-built one.
 */
export const decodeSession = decodeSessionFromUrl
