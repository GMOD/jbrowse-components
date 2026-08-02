import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

export interface LaunchCircularViewArgs {
  session: AbstractSessionModel
  assembly?: string
  // whole chromosomes to draw, in this order; the rest of the assembly's
  // contigs are left off the circle
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
  // plain view prop rather than an init key: MST restores it natively and it
  // round-trips on save. The circle auto-fits its container, so this is what
  // sizes the drawing
  height?: number
  // optional explicit view id, so another view in the same session spec can
  // reference this one
  id?: string
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-CircularView': {
      args: LaunchCircularViewArgs
      result: LaunchCircularViewArgs
    }
  }
}

export default function LaunchCircularViewF(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-CircularView | async | Programmatically launch a circular view */
  pluginManager.addToExtensionPoint('LaunchView-CircularView', args => {
    const {
      session,
      id,
      height,
      assembly,
      displayedRegionNames,
      tracks = [],
    } = args
    if (!assembly) {
      throw new Error(
        'No assembly provided when launching circular genome view',
      )
    }
    // a provided id is passed top-level so MST's optional identifier honors it
    // (undefined falls back to an auto-generated id)
    session.addView('CircularView', {
      id,
      height,
      init: {
        assembly,
        displayedRegionNames,
        tracks,
      },
    })
    return args
  })
}
