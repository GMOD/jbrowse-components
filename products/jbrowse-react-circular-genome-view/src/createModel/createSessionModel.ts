import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { cast, getParent, types } from '@jbrowse/mobx-state-tree'
import {
  BaseSessionModel,
  ConnectionManagementSessionMixin,
  DrawerWidgetSessionMixin,
  ReferenceManagementSessionMixin,
  TrackMenuSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel JBrowseReactCircularGenomeViewSessionModel
 */
export default function sessionModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'ReactCircularGenomeViewSession',
      BaseSessionModel(pluginManager),
      DrawerWidgetSessionMixin(pluginManager),
      ConnectionManagementSessionMixin(pluginManager),
      TracksManagerSessionMixin(pluginManager),
      ReferenceManagementSessionMixin(pluginManager),
      TrackMenuSessionMixin(pluginManager),
    )
    .props({
      /**
       * #property
       */
      view: pluginManager.getViewType('CircularView').stateModel,
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
      // Resolved MUI theme from the config `theme` slot, mirroring the
      // product's ThemeProvider. Lets headless/RPC consumers derive
      // theme-dependent state without a mounted component.
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
       * replaces view in this case
       */
      addView(typeName: string, initialState = {}) {
        self.view = cast({
          ...initialState,
          type: typeName,
        })
        return self.view
      },

      /**
       * #action
       * does nothing
       */
      removeView() {},
    }))
}

type SessionStateModel = ReturnType<typeof sessionModelFactory>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
