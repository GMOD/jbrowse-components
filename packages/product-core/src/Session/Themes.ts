import { addDisposer, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme, defaultThemes } from '@jbrowse/core/ui'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import type { BaseSessionModel } from '../../../../products/jbrowse-desktop/src/sessionModel/Base'
import { ThemeOptions } from '@mui/material'
import { autorun } from 'mobx'

type ThemeMap = { [key: string]: ThemeOptions }

export default function Themes(pluginManager: PluginManager) {
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
        const self = s as typeof s & BaseSessionModel
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
        const self = s as typeof s & BaseSessionModel
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
