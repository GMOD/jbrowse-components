import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { SpreadsheetViewCommands } from './types.ts'

// plain lifts: the view declares no property by any of these names
export const spreadsheetLaunchKeys =
  defineLaunchKeys<SpreadsheetViewCommands>()({
    assembly: { kind: 'launch' },
    uri: { kind: 'launch' },
    baseUri: { kind: 'launch' },
    fileType: { kind: 'launch' },
    filterText: { kind: 'launch' },
    svEventFilter: { kind: 'launch' },
  })
