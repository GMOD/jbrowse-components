import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type { AbstractSessionModel } from '../util/types/index.ts'
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

export interface TrackRowAdornmentProps {
  conf: AnyConfigurationModel
  session: AbstractSessionModel
  /**
   * the assemblies the view showing this selector displays — what a comparison
   * track is being compared *from*, which is the whole reason the adornment
   * can't be a property of the track config alone
   */
  viewAssemblyNames: string[]
}

/** Return your adornment, or `adornment` to leave another plugin's answer be. */
export type TrackRowAdornmentCallback = (
  adornment: TrackRowAdornment | undefined,
  props: TrackRowAdornmentProps,
) => TrackRowAdornment | undefined

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'TrackSelector-trackRowAdornment': {
      args: TrackRowAdornment | undefined
      result: TrackRowAdornment | undefined
      props: TrackRowAdornmentProps
    }
  }
}

// The point is fired by the hierarchical track selector, i.e. by
// plugin-data-management, but the declaration lives here for the same reason
// `Core-extraTrackMenuItems`' does: a contributing plugin does not depend on
// data-management, so an augmentation declared there is invisible to it under
// the project-reference build (`props` silently becomes `unknown`) even though
// the whole-repo typecheck, one program, sees it.
export function addTrackRowAdornment(
  pluginManager: PluginManager,
  callback: TrackRowAdornmentCallback,
) {
  pluginManager.addToExtensionPoint('TrackSelector-trackRowAdornment', callback)
}
