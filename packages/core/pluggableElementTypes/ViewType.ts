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

  // This property permits views that are 'extended' from other views to be added as a new view type in the plugin manager
  // this is critical for populating related displays, and by extension related tracks to such a view type
  extendedName?: string

  constructor(stuff: {
    name: string
    ReactComponent: ViewReactComponent
    stateModel: IAnyModelType
    extendedName?: string
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.extendedName = stuff.extendedName ? stuff.extendedName : undefined
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
