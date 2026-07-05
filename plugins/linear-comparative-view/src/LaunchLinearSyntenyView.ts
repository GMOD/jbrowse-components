import { launchSyntenyView } from '@jbrowse/synteny-core'

import { normalizeTrackLevels } from './LinearSyntenyView/util/initHelpers.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/plugin-linear-genome-view'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export interface LaunchLinearSyntenyViewArgs extends SyntenyViewSharedInit {
  session: AbstractSessionModel
  // a bare trackId string, or { trackId, displaySnapshot, trackSnapshot } to
  // configure the per-panel track (matches LinearSyntenyViewInit.views).
  // optional: the extension point receives untrusted runtime spec data, so a
  // malformed spec can omit it — the handler guards and reports a clear error
  views?: { loc?: string; assembly: string; tracks?: TrackInit[] }[]
  tracks?: string[] | string[][]
  levelHeights?: number[]
  drawCurves?: boolean
  alpha?: number
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-LinearSyntenyView': {
      args: LaunchLinearSyntenyViewArgs
      result: LaunchLinearSyntenyViewArgs
    }
  }
}

export default function LaunchLinearSyntenyView(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-LinearSyntenyView | async | Programmatically launch a linear synteny view */
  pluginManager.addToExtensionPoint('LaunchView-LinearSyntenyView', args => {
    // views/tracks and the remaining init fields (colorBy, autoDiagonalize,
    // levelHeights, ...) forward verbatim; tracks is one entry per level, with a
    // flat string[] as shorthand for "all on level 0".
    const { session, views = [], tracks = [], ...rest } = args
    launchSyntenyView(session, 'LinearSyntenyView', {
      views,
      tracks: normalizeTrackLevels(tracks),
      ...rest,
    })
    return args
  })
}
