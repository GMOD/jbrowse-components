import { ComponentType as ReactComponentType } from 'react'
import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'

export default class MenuBarType extends PluggableElementBase {
  LazyReactComponent: ReactComponentType

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    LazyReactComponent: ReactComponentType
  }) {
    super(stuff)
    this.LazyReactComponent = stuff.LazyReactComponent
    this.stateModel = stuff.stateModel
    if (!this.LazyReactComponent) {
      throw new Error(
        `no LazyReactComponent defined for menu bar type ${this.name}`,
      )
    }
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for menu bar type ${this.name}`)
    }
  }
}
