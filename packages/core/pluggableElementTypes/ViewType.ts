import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyReactComponentType } from '../util'

export default class ViewType extends PluggableElementBase {
  ReactComponent: AnyReactComponentType

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    ReactComponent: AnyReactComponentType
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
