import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config PreferencesConfigSchema
 * #category root
 * admin/embedder defaults for user-facing preferences, found on the root config
 * as `configuration.preferences`. Individual users override these at runtime
 * (persisted to localStorage) via the session `getPreference` reader; this
 * mirrors the display-level `ConfigOverrideMixin` override pattern at app scope.
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
  })
}
