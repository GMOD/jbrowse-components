import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme, defaultThemes } from '@jbrowse/core/ui'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

// locals
import type { BaseSession } from './BaseSession'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ThemeOptions } from '@mui/material'
import type { IAnyStateTreeNode, Instance } from 'mobx-state-tree'

type ThemeMap = Record<string, ThemeOptions>

/**
 * #stateModel ThemeManagerSessionMixin
 */
export function ThemeManagerSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(() => ({
      sessionThemeName: localStorageGetItem('themeName') || 'default',
    }))
    .views(s => ({
      /**
       * #method
       */
      allThemes(): ThemeMap {
        const self = s as typeof s & BaseSession
        const extraThemes = getConf(self.jbrowse, 'extraThemes')
        return { ...defaultThemes, ...extraThemes }
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
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem('themeName', self.themeName)
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
