import Plugin from '@gmod/jbrowse-core/Plugin'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import SomeIcon from '@material-ui/icons/Add'
import { autorun } from 'mobx'

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
} from '@gmod/jbrowse-core/util'
import TimelineIcon from '@material-ui/icons/Timeline'
import {
  configSchemaFactory as dotplotTrackConfigSchemaFactory,
  stateModelFactory as dotplotTrackStateModelFactory,
} from './DotplotTrack'
import DotplotRenderer, {
  configSchema as dotplotRendererConfigSchema,
  ReactComponent as DotplotRendererReactComponent,
} from './DotplotRenderer'

import {
  configSchema as PAFAdapterConfigSchema,
  AdapterClass as PAFAdapter,
} from './PAFAdapter'
import ComparativeRender from './DotplotRenderer/ComparativeRenderRpc'

export default class DotplotPlugin extends Plugin {
  name = 'DotplotPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./DotplotView')),
    )
    pluginManager.addTrackType(() => {
      const configSchema = dotplotTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'DotplotTrack',
        compatibleView: 'DotplotView',
        configSchema,
        stateModel: dotplotTrackStateModelFactory(pluginManager, configSchema),
      })
    })

    pluginManager.addRendererType(
      () =>
        new DotplotRenderer({
          name: 'DotplotRenderer',
          configSchema: dotplotRendererConfigSchema,
          ReactComponent: DotplotRendererReactComponent,
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'PAFAdapter',
          configSchema: PAFAdapterConfigSchema,
          AdapterClass: PAFAdapter,
        }),
    )

    // install our comparative rendering rpc callback
    pluginManager.addRpcMethod(() => new ComparativeRender(pluginManager))
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Dotplot view',
        icon: TimelineIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('DotplotView', {})
        },
      })
    }

    const session: any = pluginManager.rootModel?.session || {}
    const tracksAlreadyAddedTo: any[] = []
    autorun(() => {
      let views = []
      if (session.views) {
        views = session.views
      } else if (session.view) {
        views = [session.view]
      }

      views.forEach(view => {
        if (view.type === 'LinearGenomeView') {
          const { tracks } = view
          tracks.forEach(track => {
            const { type } = track
            if (!tracksAlreadyAddedTo.includes(track.id)) {
              if (type === 'PileupTrack') {
                tracksAlreadyAddedTo.push(track.id)
                track.addAdditionalContextMenuItemCallback(
                  (feature: any, track: any, pluginManager: any) => {
                    const menuItem = {
                      label: 'Dotplot of read vs ref',
                      icon: SomeIcon,
                      onClick: session => {
                        // do some stuff
                      },
                    }
                    return [menuItem]
                  },
                )
              } else if (type === 'AlignmentsTrack') {
                tracksAlreadyAddedTo.push(track.id)
                track.PileupTrack.addAdditionalContextMenuItemCallback(
                  (feature: any, track: any, pluginManager: any) => {
                    const menuItem = {
                      label: 'Dotplot of read vs ref',
                      icon: SomeIcon,
                      onClick: session => {
                        // do some stuff
                      },
                    }
                    return [menuItem]
                  },
                )
              }
            }
          })
        }
      })
    })
  }
}
