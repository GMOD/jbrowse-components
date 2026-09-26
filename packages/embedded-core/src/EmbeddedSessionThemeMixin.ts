import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseThemeFromArgs } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { resolveStyleTheme } from '@jbrowse/core/ui/styleTheme'
import { BaseSessionModel } from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SerializableThemeArgs } from '@jbrowse/core/ui'
import type { PaletteMode } from '@jbrowse/core/ui/palette'

/**
 * #stateModel EmbeddedSessionThemeMixin
 * Theme getters shared by the single-view embedded sessions
 * (react-linear-genome-view, react-circular-genome-view). Embedded products
 * have no theme picker, so the palette is always `default` and the config
 * `theme` slot supplies it; light or dark is the host's to drive, through
 * `setThemeMode`.
 */
export function EmbeddedSessionThemeMixin(pluginManager: PluginManager) {
  return BaseSessionModel(pluginManager)
    .volatile(() => ({
      sessionThemeMode: undefined as PaletteMode | undefined,
    }))
    .views(self => ({
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
          mode: self.sessionThemeMode,
        }
      },
      /**
       * #getter
       * Every color JBrowse renders, resolved to plain strings and free of any UI
       * toolkit. This is what rendering reads. See the canonical
       * `ThemeManagerSessionMixin` getter of the same name.
       */
      get palette() {
        return resolvePalette(this.themeOptions)
      },
      /**
       * #getter
       * The palette plus the sizing tokens `makeStyles` reads. See the
       * canonical `ThemeManagerSessionMixin` getter of the same name.
       */
      get styleTheme() {
        return resolveStyleTheme(this.themeOptions)
      },
      /**
       * #getter
       * Resolved MUI theme, mirroring the product's ThemeProvider. Lets
       * headless/RPC consumers derive theme-dependent state without a mounted
       * component. Shares its colors with `palette` by construction.
       */
      get theme() {
        return createJBrowseThemeFromArgs(this.themeOptions)
      },
      /**
       * #method
       * Raw `ThemeOptions` for the active theme, which every view's SVG export
       * threads into each display's `renderSvg` as a `configTheme` and rebuilds
       * outside React. The config slot is the whole answer here because it is
       * the whole of an embedded product's theming: no picker, no `allThemes`,
       * and it is what `setThemeMode` writes and `palette` resolves from. `name`
       * is accepted and ignored — the app session's counterpart looks a named
       * preset up in `allThemes()`.
       */
      getActiveThemeOptions(_name?: string) {
        // Its absence did not read as an unthemed export, it read as a *light*
        // one. Every view's export calls this optionally
        // (`session.getActiveThemeOptions?.(themeName)`), so a session without
        // it handed `undefined` down the whole path — and undefined resolves to
        // the default light palette at every step of it: the SVG chrome, the
        // colors each display bakes into its own bodies, the background rect. A
        // host following its own dark mode got a light figure out of
        // `view.exportSvg()` with nothing anywhere saying why.
        return this.themeOptions.configTheme
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Switch the session to light or dark, leaving the host's configured
       * colours alone. `themeOptions` carries the mode to the renderer, so
       * labels drawn in the worker follow it, and `palette` is derived from
       * the same args, so React-drawn elements follow it too. An embedder who
       * sets only a React-side palette leaves the worker-drawn labels in the
       * old mode.
       *
       * This used to write `palette.mode` into the config `theme` slot, which
       * meant merging at two levels to avoid discarding the brand the host had
       * passed to `createViewState`. Mode is its own axis now, so there is
       * nothing to merge and nothing to discard.
       */
      setThemeMode(mode: PaletteMode) {
        self.sessionThemeMode = mode
      },
    }))
}
