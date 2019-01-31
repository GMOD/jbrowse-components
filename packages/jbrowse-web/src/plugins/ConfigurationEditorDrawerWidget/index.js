import { lazy } from 'react'
import { observer } from 'mobx-react'
import { isStateTreeNode, getType } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import Plugin from '../../Plugin'
import DrawerWidgetType from '../../pluggableElementTypes/DrawerWidgetType'
import modelFactory from './model'

const Editor = lazy(() => import('./components/ConfigurationEditor'))

const HeadingComponent = observer(({ model }) => {
  if (model && model.target) {
    if (model.target.type) {
      return `${model.target.type} Settings`
    }
    if (isStateTreeNode(model.target)) {
      const type = getType(model.target)
      if (type && type.name) {
        return `${type.name.replace('ConfigurationSchema', '')} Settings`
      }
    }
  }
  return 'Settings'
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
