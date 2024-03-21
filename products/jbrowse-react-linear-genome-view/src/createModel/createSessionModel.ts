/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import { AbstractSessionModel } from '@jbrowse/core/util/types'
import SnackbarModel from '@jbrowse/core/ui/SnackbarModel'
import { getConf } from '@jbrowse/core/configuration'
import { cast, getParent, types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import InfoIcon from '@mui/icons-material/Info'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import {
  BaseSessionModel,
  ConnectionManagementSessionMixin,
  DialogQueueSessionMixin,
  DrawerWidgetSessionMixin,
  ReferenceManagementSessionMixin,
  SessionTracksManagerSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'

const AboutDialog = lazy(() => import('./AboutDialog'))

/**
 * #stateModel JBrowseReactLinearGenomeViewSessionModel
 * composed of
 * - [BaseSessionModel](../basesessionmodel)
 * - [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
 * - [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)
 * - [DialogQueueSessionMixin](../dialogqueuesessionmixin)
 * - [TracksManagerSessionMixin](../tracksmanagersessionmixin)
 * - [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
 * - [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)
 * - [SnackbarModel](../snackbarmodel)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function sessionModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'ReactLinearGenomeViewSession',
      BaseSessionModel(pluginManager),
      DrawerWidgetSessionMixin(pluginManager),
      ConnectionManagementSessionMixin(pluginManager),
      DialogQueueSessionMixin(pluginManager),
      TracksManagerSessionMixin(pluginManager),
      ReferenceManagementSessionMixin(pluginManager),
      SessionTracksManagerSessionMixin(pluginManager),
      SnackbarModel(),
    )
    .props({
      /**
       * #property
       */
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),

      /**
       * #property
       */
      view: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel,
    })
    .views(self => ({
      /**
       * #getter
       */
      get assemblies() {
        return [getParent<any>(self).config.assembly]
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
      get disableAddTracks() {
        return getParent<any>(self).disableAddTracks
      },

      /**
       * #method
       */
      renderProps() {
        return {
          highResolutionScaling: getConf(self, 'highResolutionScaling'),
          theme: getConf(self, 'theme'),
        }
      },

      /**
       * #getter
       */
      get version() {
        return getParent<any>(self).version
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
       */
      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }

        self.view = cast({
          ...initialState,
          type: typeName,
        })
        return self.view
      },

      removeView() {},
    }))
    .views(self => ({
      /**
       * #method
       */
      getTrackActionMenuItems(config: any) {
        return [
          {
            icon: InfoIcon,
            label: 'About track',
            onClick: () => {
              self.queueDialog(doneCallback => [
                AboutDialog,
                { config, handleClose: doneCallback },
              ])
            },
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
