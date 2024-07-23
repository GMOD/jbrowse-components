import {
  IAnyStateTreeNode,
  Instance,
  addDisposer,
  types,
} from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { getConf } from '@jbrowse/core/configuration'
import {
  JBrowseThemeOptions,
  createJBrowseTheme,
  defaultThemes,
} from '@jbrowse/core/ui'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { autorun } from 'mobx'

// locals
import { BaseSession } from './BaseSession'

type ThemeMap = Record<string, JBrowseThemeOptions>

/**
 * #stateModel ThemeManagerSessionMixin
 */
export function ThemeManagerSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(() => ({
      sessionThemeName: localStorageGetItem('themeName') || 'default',
      prefersDarkMode: localStorageGetItem('prefersDarkMode') || 'false',
      themeMode: localStorageGetItem('themeMode') || 'system',
    }))
    .views(s => ({
      /**
       * #method
       */
      allThemes(): ThemeMap {
        const self = s as typeof s & BaseSession
        const extraThemes = getConf(self.jbrowse, 'extraThemes')
        return {
          ...defaultThemes,
          ...extraThemes,
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
        const all = this.allThemes()

        const desiredMode =
          s.themeMode === 'system'
            ? JSON.parse(s.prefersDarkMode)
              ? 'dark'
              : 'light'
            : s.themeMode

        const theme =
          this.themeName === 'default'
            ? getConf(self.jbrowse, 'theme')
            : all[this.themeName]

        return createJBrowseTheme(theme, all, this.themeName, desiredMode)
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
      /**
       * #action
       */
      setThemeMode(preference: 'light' | 'dark' | 'system') {
        self.themeMode = preference
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem('themeName', self.themeName)
            localStorageSetItem('prefersDarkMode', self.prefersDarkMode)
            localStorageSetItem('themeMode', self.themeMode)
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
