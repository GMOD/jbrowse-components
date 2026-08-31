import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config PreferencesConfigSchema
 * #category root
 * admin/embedder defaults for user-facing preferences, found on the root config
 * as `configuration.preferences`. Individual users override these at runtime
 * (persisted to localStorage) via the session `getPreference` reader; a runtime
 * override map layered over config defaults, at app scope.
 */
export function PreferencesConfigSchemaFactory() {
  return ConfigurationSchema('Preferences', {
    /**
     * #slot configuration.preferences.animationMode
     * controls feature-layout animations: 'enabled' always animates (the
     * default), 'system' respects the OS prefers-reduced-motion setting,
     * 'disabled' never animates
     */
    animationMode: {
      model: types.enumeration('AnimationMode', [
        'system',
        'enabled',
        'disabled',
      ]),
      type: 'stringEnum',
      defaultValue: 'enabled',
    },
    /**
     * #slot configuration.preferences.scrollZoom
     * when true, scrolling the mouse wheel over a track zooms in and out
     * without holding Ctrl. Applies globally to all wheel-zoom views.
     */
    scrollZoom: {
      type: 'boolean',
      defaultValue: false,
    },
    /**
     * #slot configuration.preferences.numberGrouping
     * when true (the default), numbers are displayed with thousand separators
     * — `chr1:1,234,567`. Turn it off to render them bare, which is what you
     * want if you copy coordinates out of JBrowse into tools that won't accept
     * the commas. Applies to every displayed number, and takes effect on
     * reload.
     */
    numberGrouping: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot configuration.preferences.useWorkspaces
     * when true, views open in the tabbed/tiled workspace layout rather than
     * stacked vertically. Only the default: a session that names
     * `useWorkspaces` itself (a shared snapshot, or a session spec carrying a
     * `layout`) still wins, and a user's own toggle overrides it.
     */
    useWorkspaces: {
      type: 'boolean',
      defaultValue: false,
    },
    /**
     * #slot configuration.preferences.developerMode
     * when true, the ordering-contract checks a display or plugin can break
     * report themselves in the app rather than only in a development build.
     * Off by default and deliberately not in the Preferences dialog: the
     * messages are about code, and a reader who cannot change the code cannot
     * act on one. Turn it on for a site that is running a plugin under
     * development; a plugin author needs nothing here, since a plugin served
     * from localhost arms the same channel on its own, as does
     * `localStorage.jbrowseDeveloperMode`. Takes effect on reload.
     */
    developerMode: {
      type: 'boolean',
      defaultValue: false,
    },
  })
}
