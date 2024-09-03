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
      view: pluginManager.getViewType('LinearGenomeView')!
        .stateModel as LinearGenomeViewStateModel,
      /**
       * #property
       */
      sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),
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
