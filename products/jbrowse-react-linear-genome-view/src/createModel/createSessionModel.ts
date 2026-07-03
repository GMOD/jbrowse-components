import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { cast, getParent, types } from '@jbrowse/mobx-state-tree'
import {
  BaseSessionModel,
  ConnectionManagementSessionMixin,
  DrawerWidgetSessionMixin,
  ReferenceManagementSessionMixin,
  SessionTracksManagerSessionMixin,
  TrackMenuSessionMixin,
} from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import type { AssertSessionModel } from '@jbrowse/product-core'

/**
 * #stateModel JBrowseReactLinearGenomeViewSessionModel
 */

export default function sessionModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'ReactLinearGenomeViewSession',
      BaseSessionModel(pluginManager),
      DrawerWidgetSessionMixin(pluginManager),
      ConnectionManagementSessionMixin(pluginManager),
      ReferenceManagementSessionMixin(pluginManager),
      SessionTracksManagerSessionMixin(pluginManager),
      TrackMenuSessionMixin(pluginManager),
    )
    .props({
      /**
       * #property
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      view: pluginManager.getViewType('LinearGenomeView')!
        .stateModel as LinearGenomeViewStateModel,
    })
    .views(self => ({
      /**
       * #getter
       */
      get version() {
        return getParent<any>(self).version
      },
      /**
       * #getter
       */
      get disableAddTracks() {
        return getParent<any>(self).disableAddTracks
      },
      /**
       * #getter
       */
      get assemblies() {
        return [getParent<any>(self).config.assembly]
      },
      /**
       * #getter
       */
      get assemblyNames() {
        return [getParent<any>(self).config.assemblyName]
      },
      /**
       * #getter
       */
      get connections() {
        return getParent<any>(self).config.connections
      },
      /**
       * #getter
       */
      get assemblyManager() {
        return getParent<any>(self).assemblyManager
      },
      /**
       * #getter
       */
      get views() {
        return [self.view]
      },
      /**
       * #getter
       */
      // Resolved MUI theme, mirroring JBrowseLinearGenomeView's ThemeProvider
      // (createJBrowseTheme of the config `theme` slot). Lets headless/RPC
      // consumers derive theme-dependent state without a mounted component.
      get theme() {
        return createJBrowseTheme(getConf(self, 'theme'))
      },
      /**
       * #method
       */
      renderProps() {
        return {
          theme: getConf(self, 'theme'),
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addView(typeName: string, initialState = {}) {
        self.view = cast({
          ...initialState,
          type: typeName,
        })
        return self.view
      },

      removeView() {},
    }))
}

type SessionStateModel = ReturnType<typeof sessionModelFactory>

// compile-time check that the session model implements AbstractSessionModel
export type _AssertSessionModel = AssertSessionModel<
  Instance<SessionStateModel>
>
