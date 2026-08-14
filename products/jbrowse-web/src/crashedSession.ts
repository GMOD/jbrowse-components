import {
  sessionStorageGetItem,
  sessionStorageRemoveItem,
  sessionStorageSetItem,
} from '@jbrowse/core/util'

import { getSessionQueryType, stripPrefix } from './sessionLoaderHelpers.ts'
import { readQueryParams } from './useQueryParam.ts'

// The one thing a boot needs to know about the boot before it: that the last
// attempt to put this session on screen ended at the app-level ErrorBoundary,
// so restoring it silently would walk straight back into the same crash.
//
// sessionStorage, alongside the session mirror this is about (persistence.ts's
// `current`) and for the same reason: the marker is about ONE tab's attempt at
// one session. Another tab adopting the same id out of IndexedDB is a different
// attempt and gets no marker, which is right — it is running different code
// paths (loadImportedSession forks a fresh id) and may well be fine.
//
// Written through the guarded accessors because the writer is a crash handler.
// A store that refuses — Safari private browsing, a third-party frame with
// storage blocked — has to cost this recovery rung and nothing else; a throw
// here would land on top of the error already being reported.
const KEY = 'crashedSession'

export interface CrashedSession {
  /**
   * the local session id the next boot would restore, i.e. what
   * `session=local-<id>` named at the moment of the crash
   */
  id: string
  /** `${error}`, so the offer can say what happened rather than just that it did */
  message: string
  at: string
}

/**
 * The id a reload of this URL would hand to `fetchLocalSession`.
 *
 * Also the screen for "a session was loaded", which is the distinction this
 * marker has to keep: JBrowse.tsx writes `session=local-<id>` for the live
 * session, and a boot asked to restore one arrives with it already set. Without
 * that param the next boot builds a session rather than restoring one, so there
 * is nothing for a marker to name and nothing for a refresh to walk back into —
 * a config that fails to fetch (which has `LoaderErrorBanner` for a ladder)
 * lands here and is deliberately not marked.
 */
function localSessionIdFromUrl() {
  const { session } = readQueryParams(['session'])
  return session && getSessionQueryType(session) === 'local'
    ? stripPrefix(session)
    : undefined
}

/**
 * Records that this tab's session crashed. Called from the app-level
 * ErrorBoundary's `onError`, i.e. before the FatalErrorDialog whose **Refresh**
 * is the button this exists to make survivable.
 */
export function markCrashedSession(error: unknown) {
  const id = localSessionIdFromUrl()
  if (!id) {
    return
  }
  sessionStorageSetItem(
    KEY,
    JSON.stringify({
      id,
      message: `${error}`,
      at: new Date().toISOString(),
    } satisfies CrashedSession),
  )
}

export function readCrashedSession() {
  const raw = sessionStorageGetItem(KEY)
  if (!raw) {
    return undefined
  }
  try {
    const parsed = JSON.parse(raw) as CrashedSession
    // an id is the whole point of the marker — a shape without one can only
    // have come from a different writer at this key, and matching it against a
    // session id would offer recovery for a session nothing crashed on
    return typeof parsed.id === 'string' ? parsed : undefined
  } catch (e) {
    console.error(e)
    return undefined
  }
}

export function clearCrashedSession() {
  sessionStorageRemoveItem(KEY)
}
