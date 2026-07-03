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
    const { session, views, tracks = [], ...rest } = args
    // guard `!views` too: a spec that nests these fields under `init` (the shape
    // session.addView takes directly) leaves top-level `views` undefined, and a
    // bare `views.length` would throw an opaque TypeError instead of this message
    if (!views || views.length < 2) {
      throw new Error(
        'LinearSyntenyView requires at least 2 views to be specified',
      )
    }
    // tracks is one entry per level (between views[i] and views[i+1]); a flat
    // string[] is shorthand for "all on level 0". The rest of the init fields
    // (colorBy, autoDiagonalize, levelHeights, ...) forward verbatim.
    session.addView('LinearSyntenyView', {
      init: {
        views,
        tracks: normalizeTrackLevels(tracks),
        ...rest,
      },
    })
    return args
  })
}
