import { EmbeddedSessionThemeMixin } from '@jbrowse/embedded-core'
import { cast, getParent, types } from '@jbrowse/mobx-state-tree'
import {
  BaseSessionModel,
  ConnectionManagementSessionMixin,
  DrawerWidgetSessionMixin,
  ReferenceManagementSessionMixin,
  TrackMenuSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'

import type { ViewModel } from './createModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AssemblyManager,
  SessionWithConfigEditing,
  SessionWithConnections,
  SessionWithDrawerWidgets,
} from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { CircularViewStateModel } from '@jbrowse/plugin-circular-view'
import type { AssertExtends, AssertSessionModel } from '@jbrowse/product-core'

// This session lives at rootModel.session, so its MST parent is the root model;
// this is the slice it reaches for. A typed contract in place of getParent<any>,
// mirroring product-core's ConfigModelParent and web-core's AbstractWebRootModel.
interface SessionModelParent {
  version: string
  assemblyManager: AssemblyManager
  config: {
    assemblyName: string
  }
}

// Compile-time guard binding this shadow to the real root. getParent<T> is an
// unchecked assertion, so this catches SessionModelParent drifting from the
// root model (e.g. a renamed/removed prop) at build time, not runtime.
export type _SessionModelParentCheck = AssertExtends<
  ViewModel,
  SessionModelParent
>

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
      EmbeddedSessionThemeMixin(pluginManager),
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
      // `assemblies` and `connections` are intentionally omitted: BaseSessionModel
      // and ConnectionManagementSessionMixin already resolve them through
      // `self.jbrowse` (= root.config), so re-declaring here would just duplicate
      // the base getters with looser types
      get assemblyNames() {
        return [getParent<SessionModelParent>(self).config.assemblyName]
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

// compile-time checks that the session model implements AbstractSessionModel
// and each capability contract this embedded view relies on. AbstractSessionModel
// marks these capabilities optional, so it can't catch a member drifting out of
// sync with the SessionWith* interface plugins narrow to — these do.
export type _AssertSessionModel = AssertSessionModel<
  Instance<SessionStateModel>
>
export type _AssertDrawerWidgets = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithDrawerWidgets
>
export type _AssertConnections = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithConnections
>
export type _AssertConfigEditing = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithConfigEditing
>
