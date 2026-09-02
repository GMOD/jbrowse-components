import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { SvInspectorViewCommands } from './types.ts'

// The same five the spreadsheet half takes, and plain lifts for the same
// reason: this view declares no property of any of these names. Written out
// rather than borrowed from `spreadsheetLaunchKeys`, because the Record's job
// is to fail the build when this view's commands and its registration disagree.
export const svInspectorLaunchKeys =
  defineLaunchKeys<SvInspectorViewCommands>()({
    assembly: { kind: 'launch' },
    uri: { kind: 'launch' },
    baseUri: { kind: 'launch' },
    fileType: { kind: 'launch' },
    filterText: { kind: 'launch' },
  })
