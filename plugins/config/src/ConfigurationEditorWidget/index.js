import { observer } from 'mobx-react'
import { isStateTreeNode, getType } from 'mobx-state-tree'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as ReactComponent } from './components/ConfigurationEditor'
export { default as stateModelFactory } from './model'
export const configSchema = ConfigurationSchema('ConfigurationEditorWidget', {})
export const HeadingComponent = observer(({ model }) => {
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
