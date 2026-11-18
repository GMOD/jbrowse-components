import { getEnv } from '@jbrowse/core/util'

import { parseSessionFile } from './parseSessionFile.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

interface SessionWithOpenSessionCopy {
  openSessionCopy: (snapshot: Record<string, unknown>) => Promise<void>
}

/**
 * Opens a session file in place of the current session. A session that can
 * open a copy saves the one it replaces first; elsewhere the file's session is
 * set directly.
 */
export async function importSessionFile(
  session: AbstractSessionModel | SessionWithOpenSessionCopy,
  text: string,
) {
  const snapshot = parseSessionFile(text)
  if ('openSessionCopy' in session) {
    await session.openSessionCopy(snapshot)
  } else {
    await getEnv(session).pluginManager.preloadSessionTypes(snapshot)
    session.setSession?.(snapshot)
  }
}
