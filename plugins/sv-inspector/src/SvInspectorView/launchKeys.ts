import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { SvInspectorViewCommands } from './types.ts'

// written out rather than borrowed from spreadsheetLaunchKeys, so the build
// fails when this view's commands and its registration disagree
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
