import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseThemeFromArgs } from '@jbrowse/core/ui'
import { BaseSessionModel } from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SerializableThemeArgs } from '@jbrowse/core/ui'

/**
 * #stateModel EmbeddedSessionThemeMixin
 * Theme getters shared by the single-view embedded sessions
 * (react-linear-genome-view, react-circular-genome-view). Embedded products
 * have no theme switching, so the active theme is always `default`; the config
 * `theme` slot still applies via `configTheme`.
 */
export function EmbeddedSessionThemeMixin(pluginManager: PluginManager) {
  return BaseSessionModel(pluginManager).views(self => ({
    /**
     * #getter
     * Serializable theme description (the canonical `themeOptions` contract
     * shared with the app-core/web sessions). This is what crosses the RPC
     * worker boundary — e.g. the canvas display reads
     * `getSession(self).themeOptions` in its rpcProps so worker-baked colors
     * (CDS frames, stroke fallback) honor the config `theme` slot.
     */
    get themeOptions(): SerializableThemeArgs {
      return {
        configTheme: getConf(self, 'theme'),
        themeName: 'default',
      }
    },
    /**
     * #getter
     * Resolved MUI theme, mirroring the product's ThemeProvider. Lets
     * headless/RPC consumers derive theme-dependent state without a mounted
     * component.
     */
    get theme() {
      return createJBrowseThemeFromArgs(this.themeOptions)
    },
  }))
}
