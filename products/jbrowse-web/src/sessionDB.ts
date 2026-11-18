import { indexedDBAvailable } from '@jbrowse/core/util'
import { idbConnection } from '@jbrowse/core/util/idbConnection'

import type { SessionDB } from './types.ts'

const connection = idbConnection<SessionDB>('sessionsDB', 2, [
  'metadata',
  'sessions',
])

/**
 * The autosave database, shared by the session loader and every root model the
 * page builds, or undefined where there is no IndexedDB to open (jsdom, a
 * locked-down browser profile): there, autosave is off rather than failing.
 */
export async function getSessionDB() {
  return indexedDBAvailable() ? connection() : undefined
}
