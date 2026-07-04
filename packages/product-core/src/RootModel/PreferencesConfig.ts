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
     * #slot configuration.preferences.viewMargins
     * when true, views are inset with transparent side margins that act as
     * reliable mouse-wheel targets for vertical page scrolling (views otherwise
     * consume vertical wheel over their whole width)
     */
    viewMargins: {
      type: 'boolean',
      defaultValue: false,
    },
  })
}
