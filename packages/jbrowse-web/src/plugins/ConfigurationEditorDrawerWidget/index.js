import { lazy } from 'react'
import { observer } from 'mobx-react'
import { ConfigurationSchema } from '../../configuration'
import Plugin from '../../Plugin'
import DrawerWidgetType from '../../pluggableElementTypes/DrawerWidgetType'
import modelFactory from './model'

const Editor = lazy(() => import('./components/ConfigurationEditor'))

const HeadingComponent = observer(({ model }) => {
  const typeName =
    model && model.target && model.target.type ? ` ${model.target.type}` : ''
  return `Configure${typeName}`
})

export default class ConfigurationEditorDrawerWidget extends Plugin {
  install(pluginManager) {
    pluginManager.addDrawerWidgetType(() => {
      const stateModel = modelFactory(pluginManager)

      const configSchema = ConfigurationSchema(
        'ConfigurationEditorDrawerWidget',
        {},
        // TODO: Implement these configs
        // {
        //   allCollapsed: {
        //     type: 'boolean',
        //     defaultValue: false,
        //   },
        //   allExpanded: {
        //     type: 'boolean',
        //     defaultValue: false,
        //   },
        // },
      )

      return new DrawerWidgetType({
        name: 'ConfigurationEditorDrawerWidget',
        HeadingComponent,
        configSchema,
        stateModel,
        LazyReactComponent: Editor,
      })
    })
  }
}
