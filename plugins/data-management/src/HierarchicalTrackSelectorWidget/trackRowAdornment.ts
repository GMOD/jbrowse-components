import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ComponentType } from 'react'

// #region trackRowAdornment
/**
 * What a plugin adds to a track's row in the hierarchical selector, for a track
 * type whose name alone doesn't say what turning it on will do.
 *
 * The row is 22px and the drawer is narrow, so this is deliberately small:
 * a glyph that costs no width, a few words that truncate after the name does,
 * and a sentence that only appears on hover.
 */
export interface TrackRowAdornment {
  /**
   * drawn before the track name, at the row's own font size — an MUI icon
   * component, passed as a value so the selector needs no icon registry
   */
  icon?: ComponentType<{ className?: string; fontSize?: 'inherit' }>
  /**
   * a few words after the track name, e.g. `vs mm10`. Also joins the row's
   * search text, since the filter box searches what the tree shows
   */
  label?: string
  /** a sentence appended to the row's tooltip */
  detail?: string
}
// #endregion trackRowAdornment

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'TrackSelector-trackRowAdornment': {
      args: TrackRowAdornment | undefined
      result: TrackRowAdornment | undefined
      props: {
        conf: AnyConfigurationModel
        session: AbstractSessionModel
        /**
         * the assemblies the view showing this selector displays — what a
         * comparison track is being compared *from*, which is the whole reason
         * the adornment can't be a property of the track config alone
         */
        viewAssemblyNames: string[]
      }
    }
  }
}

/**
 * Ask the loaded plugins whether this track's row should say more than its
 * name. Resolved once per track where the tree's sources are assembled, not per
 * keystroke and not per render.
 */
export function trackRowAdornmentFor({
  conf,
  session,
  pluginManager,
  viewAssemblyNames,
}: {
  conf: AnyConfigurationModel
  session: AbstractSessionModel
  pluginManager: PluginManager
  viewAssemblyNames: string[]
}) {
  return pluginManager.evaluateExtensionPoint(
    /** #extensionPoint TrackSelector-trackRowAdornment | sync | Add a glyph, a short suffix and a tooltip line to a track's row in the hierarchical track selector */
    'TrackSelector-trackRowAdornment',
    undefined,
    { conf, session, viewAssemblyNames },
  )
}
