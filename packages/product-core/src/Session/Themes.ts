import { getConf, setConf } from '@jbrowse/core/configuration'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { resolveStyleTheme } from '@jbrowse/core/ui/styleTheme'
import {
  createJBrowseThemeFromArgs,
  defaultThemes,
} from '@jbrowse/core/ui/theme'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import {
  onColorSchemeChange,
  prefersDarkColorScheme,
} from '@jbrowse/core/util/systemColorScheme'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { asSession } from '../siblingCast.ts'
import { isBaseSession } from './BaseSession.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PaletteInput } from '@jbrowse/core/ui/palette'
import type { SerializableThemeArgs, ThemeMap } from '@jbrowse/core/ui/theme'
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
 * The selection that follows the OS light/dark preference rather than naming a
 * theme, and what a session starts on before anyone picks something.
 */
export const SYSTEM_THEME = 'system'

// The two ends of the light/dark axis: what `system` resolves to in each mode,
// and where the toolbar's theme control stops. `default` is the one theme that
// carries the config `theme` slot, and `darkStock` is the same brand colors
// with `mode: 'dark'`, so a site's palette survives the light half and the
// control and the `system` selection cannot disagree about either half.
const LIGHT_THEME = 'default'
const DARK_THEME = 'darkStock'

/**
 * #stateModel ThemeManagerSessionMixin
 */
export function ThemeManagerSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(() => ({
      sessionThemeName: localStorageGetItem('themeName') ?? SYSTEM_THEME,
      systemPrefersDark: prefersDarkColorScheme(),
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
         * What the user picked, as the Preferences picker shows it: a name in
         * `allThemes()`, or `system`. A stored name whose theme is no longer
         * registered reads as `default` without the stored value being
         * touched, so it comes back if the plugin supplying it loads again.
         */
        get selectedThemeName() {
          const name = self.sessionThemeName
          return name === SYSTEM_THEME || this.allThemes()[name]
            ? name
            : 'default'
        },
        /**
         * #getter
         * The theme in effect: `selectedThemeName`, with `system` resolved
         * against the OS preference.
         */
        get themeName() {
          const name = this.selectedThemeName
          return name === SYSTEM_THEME
            ? self.systemPrefersDark
              ? DARK_THEME
              : LIGHT_THEME
            : name
        },
        /**
         * #getter
         * Whether what is drawn right now is dark. Read off the resolved
         * palette, so an `extraThemes` entry declaring `mode: 'dark'` counts
         * as dark alongside the two built-in dark presets.
         */
        get themeIsDark() {
          return this.palette.mode === 'dark'
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
         * The `default` entry is merged with the config `theme` slot, because
         * the picker labels it "Default (from config)" and `resolvePalette`
         * merges the preset with the slot for every other consumer. The bare
         * preset would make `view.exportSvg()` drop a host's configured
         * palette: a config setting `primary.main` would draw `#123456` on
         * screen and export the stock `#0D233F`, while the export dialog named
         * the default theme. Every other named theme is a fixed preset that
         * ignores config.
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
       */
      setSystemPrefersDark(dark: boolean) {
        self.systemPrefersDark = dark
      },
      /**
       * #action
       * Advance the toolbar's theme control one stop: follow the system, then
       * light, then dark, then back to following the system. A theme picked in
       * Preferences that is neither stop — `Dark (minimal)`, an `extraThemes`
       * entry — counts as whichever mode it draws in, so the next click is the
       * other one.
       */
      cycleThemeMode() {
        self.sessionThemeName =
          self.selectedThemeName === SYSTEM_THEME
            ? LIGHT_THEME
            : self.themeIsDark
              ? SYSTEM_THEME
              : DARK_THEME
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
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          onColorSchemeChange(() => {
            self.setSystemPrefersDark(prefersDarkColorScheme())
          }),
        )
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
