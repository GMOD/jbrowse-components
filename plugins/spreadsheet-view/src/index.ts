import { lazy } from 'react'
import { Instance } from 'mobx-state-tree'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import ViewComfyIcon from '@material-ui/icons/ViewComfy'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import SpreadsheetViewModel from './SpreadsheetView/models/SpreadsheetView'

type SpreadsheetView = Instance<typeof SpreadsheetViewModel>

export default class SpreadsheetViewPlugin extends Plugin {
  name = 'SpreadsheetViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'SpreadsheetView',
        stateModel: SpreadsheetViewModel,
        ReactComponent: lazy(
          () => import('./SpreadsheetView/components/SpreadsheetView'),
        ),
      })
    })

    pluginManager.addToExtensionPoint(
      'LaunchView-SpreadsheetView',
      // @ts-ignore
      async ({
        session,
        assembly,
        uri,
        fileType,
      }: {
        session: AbstractSessionModel
        assembly: string
        uri: string
        fileType?: string
      }) => {
        // add view, make typescript happy with return type
        const { rootModel } = pluginManager
        const view = rootModel?.session?.addView(
          'SpreadsheetView',
        ) as SpreadsheetView

        if (!view) {
          throw new Error('Failed to initialize view')
        }
        const exts = uri.split('.')
        let ext = exts?.pop()?.toUpperCase()
        if (ext === 'GZ') {
          ext = exts?.pop()?.toUpperCase()
        }

        view.importWizard.setFileType(fileType || ext || '')
        view.importWizard.setSelectedAssemblyName(assembly)
        view.importWizard.setFileSource({
          uri,
          locationType: 'UriLocation',
        })
        view.importWizard.import(assembly)
      },
    )
  }

  configure(pluginManager: PluginManager) {
    const { rootModel } = pluginManager
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToSubMenu(['Add'], {
        label: 'Spreadsheet view',
        icon: ViewComfyIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SpreadsheetView', {})
        },
      })
    }
  }
}
