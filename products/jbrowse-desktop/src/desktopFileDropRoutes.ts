import { electronRenderer } from '@jbrowse/core/util/electron'

import type { DesktopRootModel } from './rootModel/rootModel.ts'
import type { FileDropRoutes } from '@jbrowse/app-core'

/**
 * Desktop reopens a dropped session file from disk the way File > Session >
 * Open config.json or .jbrowse file does, and opens a genome in its own dialog.
 */
export function desktopFileDropRoutes(
  rootModel: DesktopRootModel,
): FileDropRoutes {
  return {
    sessionFileExtensions: ['.jbrowse', '.json'],
    openSessionFile: async file => {
      const path = electronRenderer().webUtils.getPathForFile(file)
      if (path) {
        await rootModel.openNewSessionCallback(path)
      } else {
        throw new Error(`${file.name} is not on disk, so it cannot be opened`)
      }
    },
    openGenomeFiles: initialFiles => {
      rootModel.openGenomeDialog(initialFiles)
    },
  }
}
