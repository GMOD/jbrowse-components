import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { SvInspectorViewCommands } from './types.ts'

// The six the spreadsheet half takes and one of its properties, all plain lifts:
// this view declares no property of any of these names. Written out
// rather than borrowed from `spreadsheetLaunchKeys`, because the Record's job
// is to fail the build when this view's commands and its registration disagree.
export const svInspectorLaunchKeys =
  defineLaunchKeys<SvInspectorViewCommands>()({
    assembly: { kind: 'launch' },
    uri: { kind: 'launch' },
    baseUri: { kind: 'launch' },
    fileType: { kind: 'launch' },
    filterText: { kind: 'launch' },
    svEventFilter: { kind: 'launch' },
    drilldownTracks: { kind: 'launch' },
  })
