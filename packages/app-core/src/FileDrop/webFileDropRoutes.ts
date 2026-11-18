import { importSessionFile } from '../AppWidgets/ImportSessionWidget/importSessionFile.ts'
import { AssemblyManager } from '../AssemblyManager/index.ts'

import type { AssemblyManagerSession } from '../AssemblyManager/types.ts'
import type { FileDropRoutes } from './fileDrop.ts'

interface WebDropSession extends AssemblyManagerSession {
  openSessionCopy: (snapshot: Record<string, unknown>) => Promise<void>
}

/**
 * A browser has no path to reopen a file by, so a dropped session export is
 * read and opened as a copy, and a genome opens the assembly manager's add
 * form. A desktop .jbrowse holds a whole config rather than a session export,
 * so it is not taken for one.
 */
export function webFileDropRoutes(session: WebDropSession): FileDropRoutes {
  return {
    sessionFileExtensions: ['.json'],
    openSessionFile: async file => {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && 'session' in parsed) {
        await importSessionFile(session, text)
      } else {
        throw new Error(
          `${file.name} is not a JBrowse session export, which holds a top-level "session" key`,
        )
      }
    },
    openGenomeFiles: initialFiles => {
      session.queueDialog(onClose => [
        AssemblyManager,
        { session, onClose, initialFiles },
      ])
    },
  }
}
