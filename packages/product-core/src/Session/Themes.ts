import { getConf, setConf } from '@jbrowse/core/configuration'
import { createJBrowseThemeFromArgs, defaultThemes } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { resolveStyleTheme } from '@jbrowse/core/ui/styleTheme'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { asSession } from '../siblingCast.ts'
import { isBaseSession } from './BaseSession.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SerializableThemeArgs, ThemeMap } from '@jbrowse/core/ui'
import type { PaletteInput } from '@jbrowse/core/ui/palette'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

/**
 * What `name` actually resolves to — `default` for one `themes` no longer
 * holds. Every theme name is either stored or handed in from outside, and both
 * go stale the same way: `sessionThemeName` outlives an `extraThemes` entry an
 * admin drops, and so does a name an export dialog persisted or a saved figure
 * spec carries.
 */
function resolveThemeName(themes: ThemeMap, name: string) {
  return themes[name] ? name : 'default'
}

/**
 * #stateModel ThemeManagerSessionMixin
 */
export function ThemeManagerSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(() => ({
      sessionThemeName: localStorageGetItem('themeName') ?? 'default',
    }))
    .views(s => {
      const self = asSession(s)
      return {
        /**
         * #method
         */
        allThemes(): ThemeMap {
          const extraThemes = getConf(self.jbrowse, 'extraThemes')
          return { ...defaultThemes, ...extraThemes }
        },
        /**
         * #getter
         */
        get themeName() {
          return resolveThemeName(this.allThemes(), self.sessionThemeName)
        },
        /**
         * #getter
         */
        // Structurally-serializable description of the active theme, safe to
        // send across the RPC worker boundary (the created `theme` carries
        // functions and cannot be cloned). The worker rebuilds via
        // createJBrowseThemeFromArgs.
        get themeOptions(): SerializableThemeArgs {
          return {
            configTheme: getConf(self.jbrowse, 'theme'),
            extraThemes: getConf(self.jbrowse, 'extraThemes'),
            themeName: this.themeName,
          }
        },
        /**
         * #getter
         * Every color JBrowse renders, resolved to plain strings. This is what
         * rendering reads: it needs no React context, it crosses the RPC worker
         * boundary as itself, and it costs no UI toolkit. Prefer it over
         * `theme` anywhere the answer wanted is a color rather than a Material
         * UI component style.
         */
        get palette() {
          return resolvePalette(this.themeOptions)
        },
        /**
         * #getter
         * The palette plus the sizing tokens `makeStyles` reads — spacing,
         * corner radius, type scale. This is what a product mounts on
         * `StyleThemeProvider`; it costs no UI toolkit, and it is derived from
         * the same `themeOptions` as `theme`, so a config `theme` that sets
         * `spacing` moves JBrowse's own styles and its Material components
         * together.
         */
        get styleTheme() {
          return resolveStyleTheme(this.themeOptions)
        },
        /**
         * #getter
         * The Material UI theme, for the components that are Material UI. Its
         * palette is spliced from the same `resolvePalette` call as `palette`
         * above, so the two cannot disagree.
         */
        get theme() {
          return createJBrowseThemeFromArgs(this.themeOptions)
        },
        /**
         * #method
         * Raw `ThemeOptions` for the active theme, or a named override (used by
         * the SVG-export theme picker). Unlike `theme` (a built,
         * non-serializable MUI theme), this is the plain options object every
         * view's SVG export threads into each display's `renderSvg`, which
         * rebuilds the theme via `createJBrowseTheme` outside React context.
         *
         * The `default` entry is spliced with the config `theme` slot, because
         * the preset is only half of what that entry means — the picker calls it
         * "Default (from config)" and `resolvePalette` merges the two for every
         * other consumer. Returning the bare preset made `view.exportSvg()`
         * silently drop a host's configured palette: a config setting
         * `primary.main` drew `#123456` on screen and exported the stock
         * `#0D233F`, with the export dialog reporting the theme it had not used.
         * Every other named theme is a fixed preset that ignores config, which is
         * the distinction this ternary keeps.
         */
        getActiveThemeOptions(name?: string) {
          const all = this.allThemes()
          const themeName = resolveThemeName(all, name ?? this.themeName)
          const theme = all[themeName]
          if (themeName !== 'default') {
            return theme
          }
          // shallow over the palette, which is how `resolvePalette` spreads the
          // same two — `mode` and `primary` are siblings there, so both levels
          // have to survive
          const configTheme = getConf(self.jbrowse, 'theme') as ThemeOptions
          return {
            ...theme,
            ...configTheme,
            palette: { ...theme?.palette, ...configTheme.palette },
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setThemeName(name: string) {
        self.sessionThemeName = name
      },
      /**
       * #action
       * Point the session at light or dark, for a host that follows its own
       * dark-mode state rather than offering JBrowse's theme menu. Satisfies
       * `ThemeModeSession`, so `useSessionPalette` works against an app
       * session and an embedded one alike.
       *
       * Expressed as a write to the config `theme` slot plus a return to the
       * `default` theme, not as `setThemeName('darkStock')`. Only the
       * `default` theme merges `configTheme.palette` (see `resolvePalette`),
       * so selecting a stock theme would discard whatever the host passed as
       * `configuration.theme` — their brand `primary`, say — the first time
       * their toggle fired. Merging at both levels for the same reason:
       * `theme` is a frozen slot, and `mode` and `primary` are siblings under
       * `palette`.
       *
       * One write, not two: `themeOptions` is derived from the same slot and
       * is what ships to the RPC worker, so the labels baked into a rendered
       * image follow the mode along with what React draws.
       */
      setThemeMode(mode: 'light' | 'dark') {
        const { jbrowse } = asSession(self)
        const theme: { palette?: PaletteInput } =
          getConf(jbrowse, 'theme') ?? {}
        setConf(jbrowse, 'theme', {
          ...theme,
          palette: { ...theme.palette, mode },
        })
        self.sessionThemeName = 'default'
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function themeNameAutorun() {
              // persist the raw selection, not the coerced themeName, so a
              // theme registered later isn't clobbered with 'default'
              localStorageSetItem('themeName', self.sessionThemeName)
            },
            { name: 'ThemeName' },
          ),
        )
      },
    }))
}

/** Session mixin MST type for a session that supports theming */
export type SessionWithThemesType = ReturnType<typeof ThemeManagerSessionMixin>

/** Instance of a session that has theming support */
export type SessionWithThemes = Instance<SessionWithThemesType>

/** Type guard for SessionWithThemes */
export function isSessionWithThemes(
  session: IAnyStateTreeNode,
): session is SessionWithThemes {
  return isBaseSession(session) && 'theme' in session
}
