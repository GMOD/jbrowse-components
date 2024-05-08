import {
  IAnyStateTreeNode,
  Instance,
  addDisposer,
  types,
} from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme, defaultThemes } from '@jbrowse/core/ui'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { ThemeOptions } from '@mui/material'
import { autorun } from 'mobx'

// locals
import { BaseSession } from './BaseSession'

type ThemeMap = Record<string, ThemeOptions>

/**
 * #stateModel ThemeManagerSessionMixin
 */
export function ThemeManagerSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(() => ({
      sessionThemeName: localStorageGetItem('themeName') || 'default',
      prefersDarkMode: localStorageGetItem('prefersDarkMode') || 'false',
    }))
    .views(s => ({
      /**
       * #getter
       */
      get configTheme() {
        const self = s as typeof s & BaseSession
        const configTheme = getConf(self.jbrowse, 'theme')
        // placeholder structure to identify the default config theme
        return {
          config: {
            palette: {
              ...defaultThemes.default.palette,
              ...configTheme.palette,
            },
            name: 'config',
          },
        } as ThemeOptions
      },
      /**
       * #getter
       */
      get extraThemes() {
        const self = s as typeof s & BaseSession
        const extraThemes = getConf(self.jbrowse, 'extraThemes')
        return extraThemes
      },
      /**
       * #getter
       */
      get lightTheme() {
        const theme = Object.entries({
          ...this.configTheme,
          ...this.extraThemes,
          ...defaultThemes,
        } as ThemeMap).find(
          ([_, theme]) =>
            theme.palette?.mode === 'light' ||
            theme.palette?.mode === undefined,
        ) ?? [undefined, undefined]

        return theme ?? undefined
      },
      /**
       * #getter
       */
      get darkTheme() {
        const theme = Object.entries({
          ...this.configTheme,
          ...this.extraThemes,
          ...defaultThemes,
        } as ThemeMap).find(([_, theme]) => theme.palette?.mode === 'dark') ?? [
          undefined,
          undefined,
        ]

        return theme ?? undefined
      },
      /**
       * #getter
       */
      get systemTheme() {
        const [name, theme] =
          s.prefersDarkMode === 'true' && this.darkTheme[1]
            ? this.darkTheme
            : this.lightTheme

        const sysTheme = {
          ...theme,
          name: `Use system setting (${name})`,
        }
        return sysTheme as ThemeOptions
      },
      /**
       * #method
       */
      allThemes(): ThemeMap {
        return {
          ...defaultThemes,
          ...this.extraThemes,
          system: { ...this.systemTheme },
        }
      },
      /**
       * #getter
       */
      get themeName() {
        const { sessionThemeName } = s
        const all = this.allThemes()
        return all[sessionThemeName] ? sessionThemeName : 'default'
      },
      /**
       * #getter
       */
      get theme() {
        const self = s as typeof s & BaseSession
        const configTheme = getConf(self.jbrowse, 'theme')
        const all = this.allThemes()
        return createJBrowseTheme(configTheme, all, this.themeName)
      },
    }))
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
      setPrefersDarkMode(preference: string) {
        self.prefersDarkMode = preference
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem('themeName', self.themeName)
            localStorageSetItem('prefersDarkMode', self.prefersDarkMode)
          }),
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
  return 'theme' in session
}
