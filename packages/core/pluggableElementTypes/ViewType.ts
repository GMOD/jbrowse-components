import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'

type ViewReactComponent = React.ComponentType<{ model: never }>

export default class ViewType extends PluggableElementBase {
  ReactComponent: ViewReactComponent

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    ReactComponent: ViewReactComponent
    stateModel: IAnyModelType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.stateModel = stuff.stateModel
    if (!this.ReactComponent) {
      throw new Error(`no ReactComponent defined for view ${this.name}`)
    }
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for view ${this.name}`)
    }
  }
}
