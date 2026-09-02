import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { SpreadsheetViewCommands } from './types.ts'

// All five are plain lifts: the view declares no property of any of these
// names, so there is nothing to tell them apart from. `height`,
// `hideVerticalResizeHandle` and the rest are declared, and the partition
// leaves them on the snapshot for MST to restore.
export const spreadsheetLaunchKeys =
  defineLaunchKeys<SpreadsheetViewCommands>()({
    assembly: { kind: 'launch' },
    uri: { kind: 'launch' },
    baseUri: { kind: 'launch' },
    fileType: { kind: 'launch' },
    filterText: { kind: 'launch' },
  })
