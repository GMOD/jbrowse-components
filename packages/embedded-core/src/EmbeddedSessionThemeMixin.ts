import { getConf, setConf } from '@jbrowse/core/configuration'
import { createJBrowseThemeFromArgs } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { resolveStyleTheme } from '@jbrowse/core/ui/styleTheme'
import { BaseSessionModel } from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SerializableThemeArgs } from '@jbrowse/core/ui'
import type { PaletteInput } from '@jbrowse/core/ui/palette'

/**
 * #stateModel EmbeddedSessionThemeMixin
 * Theme getters shared by the single-view embedded sessions
 * (react-linear-genome-view, react-circular-genome-view). Embedded products
 * have no theme switching, so the active theme is always `default`; the config
 * `theme` slot still applies via `configTheme`.
 */
export function EmbeddedSessionThemeMixin(pluginManager: PluginManager) {
  return BaseSessionModel(pluginManager)
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
       * Point the session at light or dark. One write, not two: the `theme`
       * slot is what `themeOptions` ships to the renderer, so the labels baked
       * in the worker follow it, and `palette` is derived from the same slot,
       * so what React draws follows it too. An embedder who sets only a
       * React-side palette leaves the baked labels behind.
       *
       * Merges rather than replaces, at both levels. `theme` is a frozen slot,
       * so a bare `setConf(session, 'theme', { palette: { mode } })` — the
       * obvious form, and what the build-your-own examples each wrote — drops
       * every other key in it. That silently discards whatever the host passed
       * as `createViewState`'s `configuration.theme` (a brand `primary`, say)
       * the first time their dark-mode toggle fires. `resolvePalette` spreads
       * `configTheme.palette` over the preset shallowly, so `mode` and
       * `primary` are siblings and both levels have to survive.
       */
      setThemeMode(mode: 'light' | 'dark') {
        const theme: { palette?: PaletteInput } = getConf(self, 'theme') ?? {}
        setConf(self, 'theme', {
          ...theme,
          palette: { ...theme.palette, mode },
        })
      },
    }))
}
