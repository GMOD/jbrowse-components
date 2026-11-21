import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'

/**
 * #config PreferencesConfigSchema
 * #category root
 * Sets an admin's or embedder's defaults for user-facing preferences, found on
 * the root config as `configuration.preferences`. Each user's runtime
 * overrides, kept in localStorage, sit over these defaults at app scope, and
 * the session's `getPreference` reads the result.
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
     * #slot configuration.preferences.showBandChips
     * when true (the default), a track drawing several bands (an alignments
     * track's coverage, junctions and reads, a MAF track's conservation)
     * names each band with a chip over its top-left corner, whose × hides the
     * band. Turn it off to draw the bands without chips; the track menu still
     * shows and hides them. An SVG export titles its bands either way.
     */
    showBandChips: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot configuration.preferences.numberGrouping
     * when true (the default), numbers are displayed with thousand separators
     * (`chr1:1,234,567`). Turn it off to display them without separators, for
     * copying coordinates into tools that won't accept the commas. Applies to every displayed number, and takes effect on
     * reload.
     */
    numberGrouping: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot configuration.preferences.developerMode
     * when true, the ordering-contract checks a display or plugin can break
     * report themselves in the app rather than only in a development build.
     * Off by default and deliberately not in the Preferences dialog: the
     * messages are about code, and a reader who cannot change the code cannot
     * act on one. Turn it on for a site that is running a plugin under
     * development; a plugin author needs nothing here, since a plugin served
     * from localhost arms the same channel automatically, as does
     * `localStorage.jbrowseDeveloperMode`. Takes effect on reload.
     */
    developerMode: {
      type: 'boolean',
      defaultValue: false,
    },
  })
}
