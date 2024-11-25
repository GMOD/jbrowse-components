import { lazy } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import SnackbarModel from '@jbrowse/core/ui/SnackbarModel'
import {
  BaseSessionModel,
  ConnectionManagementSessionMixin,
  DialogQueueSessionMixin,
  DrawerWidgetSessionMixin,
  ReferenceManagementSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'
import InfoIcon from '@mui/icons-material/Info'
import { getParent, types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'
import type { Instance } from 'mobx-state-tree'

const AboutDialog = lazy(() => import('./AboutDialog'))

/**
 * #stateModel JBrowseReactCircularGenomeViewSessionModel
 * composed of
 * - [BaseSessionModel](../basesessionmodel)
 * - [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
 * - [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)
 * - [DialogQueueSessionMixin](../dialogqueuesessionmixin)
 * - [TracksManagerSessionMixin](../tracksmanagersessionmixin)
 * - [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
 * - [SnackbarModel](../snackbarmodel)
 */
export default function sessionModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'ReactCircularGenomeViewSession',
      BaseSessionModel(pluginManager),
      DrawerWidgetSessionMixin(pluginManager),
      ConnectionManagementSessionMixin(pluginManager),
      DialogQueueSessionMixin(pluginManager),
      TracksManagerSessionMixin(pluginManager),
      ReferenceManagementSessionMixin(pluginManager),
      SnackbarModel(),
    )
    .props({
      /**
       * #property
       */
      view: pluginManager.getViewType('CircularView')!.stateModel,
    })
    .volatile((/* self */) => ({
      /**
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * `{ taskName: "configure", target: thing_being_configured }`
       */
      task: undefined,
    }))
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
       * #method
       */
      renderProps() {
        return {
          theme: getConf(self, 'theme'),
          highResolutionScaling: getConf(self, 'highResolutionScaling'),
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * replaces view in this case
       */
      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }

        self.view = {
          ...initialState,
          type: typeName,
        }
        return self.view
      },

      /**
       * #action
       * does nothing
       */
      removeView() {},
    }))
    .views(self => ({
      /**
       * #method
       */
      getTrackActionMenuItems(config: any) {
        return [
          {
            label: 'About track',
            onClick: () => {
              self.queueDialog(doneCallback => [
                AboutDialog,
                { config, handleClose: doneCallback },
              ])
            },
            icon: InfoIcon,
          },
        ]
      },
    }))
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>
export type SessionModel = Instance<SessionStateModel>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
