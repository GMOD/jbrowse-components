import { getConf } from '@jbrowse/core/configuration'
import { resolvePalette, resolveThemeSelection } from '@jbrowse/core/ui/palette'
import { resolveStyleTheme } from '@jbrowse/core/ui/styleTheme'
import {
  createJBrowseThemeFromArgs,
  defaultThemes,
} from '@jbrowse/core/ui/theme'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import {
  darkReaderIsDark,
  onColorSchemeChange,
  onDarkReaderChange,
  prefersDarkColorScheme,
} from '@jbrowse/core/util/systemColorScheme'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { asSession } from '../siblingCast.ts'
import { isBaseSession } from './BaseSession.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PaletteMode } from '@jbrowse/core/ui/palette'
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

/** The three the mode picker offers; `system` follows the OS preference. */
export type ThemeModeSelection = PaletteMode | 'system'

/**
 * A session starts light, and follows the OS only when asked to. A dark OS is
 * not a request for a dark genome browser.
 */
const DEFAULT_MODE: ThemeModeSelection = 'light'

function systemMode(): PaletteMode {
  return prefersDarkColorScheme() ? 'dark' : 'light'
}

// An override outlives a reload only while the OS still disagrees with it; one
// the OS has since come round to means following again.
function storedOverride(): PaletteMode | undefined {
  const stored = localStorageGetItem('themeModeOverride')
  return (stored === 'light' || stored === 'dark') && stored !== systemMode()
    ? stored
    : undefined
}

// A `themeName` stored before light and dark were an axis spells a mode into
// the name. Split it once, on the way in, so the session persists the pair from
// then on and the retired name goes away; a name this does not know — an
// `extraThemes` entry whose plugin is absent — passes through untouched.
function storedSelection() {
  const stored = localStorageGetItem('themeName') ?? 'default'
  const { themeName, mode } = resolveThemeSelection(stored)
  const storedMode = localStorageGetItem('themeMode') as
    | ThemeModeSelection
    | undefined
  return {
    sessionThemeName: themeName,
    sessionThemeMode: storedMode ?? mode ?? DEFAULT_MODE,
    systemThemeOverride: storedOverride(),
  }
}

/**
 * The theme the stored selection resolves to, for UI drawn before a session
 * exists, such as Desktop's start screen.
 */
export function storedThemeArgs(): SerializableThemeArgs {
  const { sessionThemeName, sessionThemeMode, systemThemeOverride } =
    storedSelection()
  return {
    themeName: sessionThemeName,
    mode:
      systemThemeOverride ??
      (sessionThemeMode === 'system' ? systemMode() : sessionThemeMode),
  }
}

/**
 * #stateModel ThemeManagerSessionMixin
 */
export function ThemeManagerSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(() => ({
      ...storedSelection(),
      systemPrefersDark: prefersDarkColorScheme(),
      darkReaderDark: darkReaderIsDark(),
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
         * Which palette is in effect. A stored name whose theme an admin has
         * since dropped reads as `default` without the stored value being
         * touched, so it comes back if the plugin supplying it loads again.
         */
        get themeName() {
          return resolveThemeName(this.allThemes(), self.sessionThemeName)
        },
        /**
         * #getter
         * Light, dark, or following the OS — the axis the palette is drawn
         * along, and what the mode picker shows. `effectiveThemeMode` is the
         * one to read for a color decision.
         */
        get themeMode(): ThemeModeSelection {
          return self.sessionThemeMode
        },
        /**
         * #getter
         * Light or dark as the reader chose it, `system` resolved against the
         * OS or the toolbar's hold. What a file leaves the session in, since
         * Dark Reader never touches the file.
         */
        get selectedThemeMode(): PaletteMode {
          if (self.systemThemeOverride) {
            return self.systemThemeOverride
          }
          return this.themeMode === 'system'
            ? self.systemPrefersDark
              ? 'dark'
              : 'light'
            : this.themeMode
        },
        /**
         * #getter
         * `selectedThemeMode`, but dark while Dark Reader darkens the page.
         */
        get effectiveThemeMode(): PaletteMode {
          return self.darkReaderDark ? 'dark' : this.selectedThemeMode
        },
        /**
         * #getter
         * Whether what is drawn right now is dark. Read off the resolved
         * palette rather than the mode, so a palette pinned to one mode — an
         * `extraThemes` entry declaring `mode: 'dark'` — answers for itself.
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
            mode: this.effectiveThemeMode,
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
         *
         * **The mode is spliced in here**, because a palette no longer carries
         * one and this is the last point before the export leaves the session:
         * every caller hands `renderSvg` these options and nothing else, so a
         * figure exported from a dark session comes out dark. A palette pinned
         * to its own mode, or a `name` from before the axis, states the mode
         * itself and keeps it.
         */
        getActiveThemeOptions(name?: string): ThemeOptions {
          const all = this.allThemes()
          const selection = resolveThemeSelection(
            name ?? this.themeName,
            undefined,
            all,
          )
          const themeName = resolveThemeName(all, selection.themeName)
          const theme = all[themeName]
          const mode =
            theme?.palette?.mode ?? selection.mode ?? this.selectedThemeMode
          if (themeName !== 'default') {
            return { ...theme, palette: { ...theme?.palette, mode } }
          }
          // shallow over the palette, which is how `resolvePalette` spreads the
          // same two — `mode` and `primary` are siblings there, so both levels
          // have to survive
          const configTheme = getConf(self.jbrowse, 'theme') as ThemeOptions
          return {
            ...theme,
            ...configTheme,
            palette: { ...theme?.palette, ...configTheme.palette, mode },
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Pick a palette. A name from before light and dark were an axis sets
       * the mode it spelled as well, so an old share link, a saved figure spec
       * and `jbrowse-img --theme darkStock` all still mean what they said.
       * Either that or a palette pinned to its own mode drops a held mode,
       * which would otherwise resurface on the next palette change.
       */
      setThemeName(name: string) {
        const { themeName, mode } = resolveThemeSelection(name)
        self.sessionThemeName = themeName
        if (mode) {
          self.sessionThemeMode = mode
        }
        const drawnMode = self.themeIsDark ? 'dark' : 'light'
        if (mode || drawnMode !== self.effectiveThemeMode) {
          self.systemThemeOverride = undefined
        }
      },
      /**
       * #action
       */
      noteDarkReader() {
        self.darkReaderDark = darkReaderIsDark()
      },
      /**
       * #action
       */
      setSystemPrefersDark(dark: boolean) {
        if (dark !== self.systemPrefersDark) {
          self.systemThemeOverride = undefined
        }
        self.systemPrefersDark = dark
      },
      /**
       * #action
       * Hold a session on the mode its setting is not asking for, or
       * `undefined` to return to the setting. The toolbar's sun/moon writes
       * this, so it stays in the toolbar after a click. The OS flipping clears
       * it, since by then the OS has come round to the held mode. The
       * palette is untouched: a reader on Minimal who does this keeps Minimal.
       */
      setSystemThemeOverride(mode?: PaletteMode) {
        self.systemThemeOverride = mode
      },
      /**
       * #action
       * Draw the session light or dark, leaving the palette alone. `system`
       * follows the OS preference. Satisfies `ThemeModeSession`, so
       * `useSessionPalette` works against an app session and an embedded one
       * alike, and a host that follows its own dark-mode state calls this.
       *
       * `themeOptions` carries the mode to the RPC worker, so the labels baked
       * into a rendered image follow it along with what React draws. That used
       * to take a write into the config `theme` slot, because mode lived
       * inside a palette and there was nowhere else to put it.
       */
      setThemeMode(mode: ThemeModeSelection) {
        self.sessionThemeMode = mode
        self.systemThemeOverride = undefined
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
          onDarkReaderChange(() => {
            self.noteDarkReader()
          }),
        )
        addDisposer(
          self,
          autorun(
            function themeNameAutorun() {
              // persist the raw selection, not the coerced themeName, so a
              // theme registered later isn't clobbered with 'default'
              localStorageSetItem('themeName', self.sessionThemeName)
              localStorageSetItem('themeMode', self.sessionThemeMode)
              localStorageSetItem(
                'themeModeOverride',
                self.systemThemeOverride ?? '',
              )
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
