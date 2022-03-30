import React from 'react'
import { IAnyModelType, IAnyStateTreeNode } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import DisplayType from './DisplayType'

type BasicView = React.ComponentType<{
  // TODO: can we use AbstractViewModel here?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
  session?: IAnyStateTreeNode
}>
type ViewReactComponent = React.LazyExoticComponent<BasicView> | BasicView

export default class ViewType extends PluggableElementBase {
  ReactComponent: ViewReactComponent

  stateModel: IAnyModelType

  displayTypes: DisplayType[] = []

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

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
