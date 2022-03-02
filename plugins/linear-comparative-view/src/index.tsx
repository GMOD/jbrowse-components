import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  getSession,
  getContainingTrack,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import AddIcon from '@material-ui/icons/Add'
import CalendarIcon from '@material-ui/icons/CalendarViewDay'
// locals
//
import {
  configSchemaFactory as linearComparativeDisplayConfigSchemaFactory,
  ReactComponent as LinearComparativeDisplayReactComponent,
  stateModelFactory as linearComparativeDisplayStateModelFactory,
} from './LinearComparativeDisplay'
import LinearComparativeViewFactory from './LinearComparativeView'
import {
  configSchemaFactory as linearSyntenyDisplayConfigSchemaFactory,
  stateModelFactory as linearSyntenyDisplayStateModelFactory,
} from './LinearSyntenyDisplay'
import LinearSyntenyRenderer, {
  configSchema as linearSyntenyRendererConfigSchema,
  ReactComponent as LinearSyntenyRendererReactComponent,
} from './LinearSyntenyRenderer'
import LinearSyntenyViewFactory from './LinearSyntenyView'

export default class extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(LinearComparativeViewFactory),
    )
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(LinearSyntenyViewFactory),
    )

    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'SyntenyTrack',
        {},
        { baseConfiguration: createBaseTrackConfig(pluginManager) },
      )
      return new TrackType({
        name: 'SyntenyTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'SyntenyTrack',
          configSchema,
        ),
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema =
        linearComparativeDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearComparativeDisplay',
        configSchema,
        stateModel: linearComparativeDisplayStateModelFactory(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearComparativeView',
        ReactComponent: LinearComparativeDisplayReactComponent,
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema =
        linearSyntenyDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearSyntenyDisplay',
        configSchema,
        stateModel: linearSyntenyDisplayStateModelFactory(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearSyntenyView',
        ReactComponent: LinearComparativeDisplayReactComponent,
      })
    })

    pluginManager.addRendererType(
      () =>
        new LinearSyntenyRenderer({
          name: 'LinearSyntenyRenderer',
          configSchema: linearSyntenyRendererConfigSchema,
          ReactComponent: LinearSyntenyRendererReactComponent,
          pluginManager,
        }),
    )

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: PluggableElementType) => {
        if (pluggableElement.name === 'LinearPileupDisplay') {
          const { stateModel } = pluggableElement as ViewType
          const newStateModel = stateModel.extend(
            (self: LinearPileupDisplayModel) => {
              const superContextMenuItems = self.contextMenuItems
              return {
                views: {
                  contextMenuItems() {
                    const feature = self.contextMenuFeature
                    if (!feature) {
                      return superContextMenuItems()
                    }
                    const newMenuItems = [
                      ...superContextMenuItems(),
                      {
                        label: 'Linear read vs ref',
                        icon: AddIcon,
                        onClick: () => {
                          getSession(self).queueDialog(
                            (doneCallback: Function) => [
                              WindowSizeDlg,
                              {
                                track: getContainingTrack(self),
                                feature,
                                handleClose: doneCallback,
                              },
                            ],
                          )
                        },
                      },
                    ]

                    return newMenuItems
                  },
                },
              }
            },
          )

          ;(pluggableElement as DisplayType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Linear synteny view',
        icon: CalendarIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('LinearSyntenyView', {})
        },
      })
    }
  }
}
