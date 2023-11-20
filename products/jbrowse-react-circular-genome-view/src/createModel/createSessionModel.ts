/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import { AbstractSessionModel } from '@jbrowse/core/util/types'
import { getParent, types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import InfoIcon from '@mui/icons-material/Info'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import {
  BaseSessionModel,
  ConnectionManagementSessionMixin,
  DialogQueueSessionMixin,
  DrawerWidgetSessionMixin,
  ReferenceManagementSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'

const AboutDialog = lazy(() => import('./AboutDialog'))

/**
 * #stateModel JBrowseReactCircularGenomeViewSessionModel
 * composed of
 * - BaseSessionModel
 * - DrawerWidgetSessionMixin
 * - ConnectionManagementSessionMixin
 * - DialogQueueSessionMixin
 * - TracksManagerSessionMixin
 * - ReferenceManagementSessionMixin
 * - SnackbarModel
 */
export default function sessionModelFactory(pluginManager: PluginManager) {
  const model = types
    .compose(
      'ReactCircularGenomeViewSession',
      BaseSessionModel(pluginManager),
      DrawerWidgetSessionMixin(pluginManager),
      ConnectionManagementSessionMixin(pluginManager),
      DialogQueueSessionMixin(pluginManager),
      TracksManagerSessionMixin(pluginManager),
      ReferenceManagementSessionMixin(pluginManager),
    )
    .props({
      /**
       * #property
       */
      view: pluginManager.getViewType('CircularView').stateModel,
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
        return { theme: readConfObject(self.configuration, 'theme') }
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

  return addSnackbarToModel(model)
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>
export type SessionModel = Instance<SessionStateModel>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
