import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseThemeFromArgs, defaultThemes } from '@jbrowse/core/ui'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { isBaseSession } from './BaseSession.ts'

import type { BaseSession } from './BaseSession.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { SerializableThemeArgs, ThemeMap } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

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
      // this mixin is always composed onto a base session; alias once instead
      // of re-casting self in every view
      const self = s as typeof s & BaseSession
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
          const { sessionThemeName } = self
          const all = this.allThemes()
          return all[sessionThemeName] ? sessionThemeName : 'default'
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
         */
        getActiveThemeOptions(name?: string) {
          return this.allThemes()[name ?? this.themeName]
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
