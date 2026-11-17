import { getEnv } from '@jbrowse/core/util'

import { parseSessionFile } from '../AppWidgets/ImportSessionWidget/parseSessionFile.ts'
import { AssemblyManager } from '../AssemblyManager/index.ts'

import type { AssemblyManagerSession } from '../AssemblyManager/types.ts'
import type { FileDropRoutes } from './fileDrop.ts'

interface WebDropSession extends AssemblyManagerSession {
  setSession: (snapshot: Record<string, unknown>) => void
}

/**
 * A browser has no path to reopen a file by, so a dropped session export is
 * read and imported the way File > Import session does, and a genome opens the
 * assembly manager's add form. A desktop .jbrowse holds a whole config rather
 * than a session export, so it is not taken for one.
 */
export function webFileDropRoutes(session: WebDropSession): FileDropRoutes {
  return {
    sessionFileExtensions: ['.json'],
    openSessionFile: async file => {
      const snapshot = parseSessionFile(await file.text())
      await getEnv(session).pluginManager.preloadSessionTypes(snapshot)
      session.setSession(snapshot)
    },
    openGenomeFiles: initialFiles => {
      session.queueDialog(onClose => [
        AssemblyManager,
        { session, onClose, initialFiles },
      ])
    },
  }
}
