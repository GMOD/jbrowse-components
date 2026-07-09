import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseThemeFromArgs } from '@jbrowse/core/ui'
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
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SerializableThemeArgs } from '@jbrowse/core/ui'
import type { AssemblyManager } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { CircularViewStateModel } from '@jbrowse/plugin-circular-view'
import type { AssertSessionModel } from '@jbrowse/product-core'

// This session lives at rootModel.session, so its MST parent is the root model;
// this is the slice it reaches for. A typed contract in place of getParent<any>,
// mirroring product-core's ConfigModelParent and web-core's AbstractWebRootModel.
interface SessionModelParent {
  version: string
  assemblyManager: AssemblyManager
  config: {
    assembly: AnyConfigurationModel
    assemblyName: string
    connections: AnyConfigurationModel[]
  }
}

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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      view: pluginManager.getViewType('CircularView')!
        .stateModel as CircularViewStateModel,
    })
    .views(self => ({
      /**
       * #getter
       */
      get version() {
        return getParent<SessionModelParent>(self).version
      },
      /**
       * #getter
       */
      get assemblies() {
        return [getParent<SessionModelParent>(self).config.assembly]
      },
      /**
       * #getter
       */
      get assemblyNames() {
        return [getParent<SessionModelParent>(self).config.assemblyName]
      },
      /**
       * #getter
       */
      get connections() {
        return getParent<SessionModelParent>(self).config.connections
      },
      /**
       * #getter
       */
      get assemblyManager() {
        return getParent<SessionModelParent>(self).assemblyManager
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
      // Serializable theme description (the canonical `themeOptions` contract
      // shared with the app-core/web sessions), safe to cross the RPC worker
      // boundary. There is no theme switching here, so the active theme is
      // always 'default'.
      get themeOptions(): SerializableThemeArgs {
        return {
          configTheme: getConf(self, 'theme'),
          themeName: 'default',
        }
      },
      /**
       * #getter
       */
      // Resolved MUI theme, mirroring the product's ThemeProvider. Lets
      // headless/RPC consumers derive theme-dependent state without a mounted
      // component.
      get theme() {
        return createJBrowseThemeFromArgs(this.themeOptions)
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

// compile-time check that the session model implements AbstractSessionModel
export type _AssertSessionModel = AssertSessionModel<
  Instance<SessionStateModel>
>
