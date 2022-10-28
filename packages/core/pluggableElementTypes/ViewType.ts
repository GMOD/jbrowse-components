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

  // extendedName can be used for when you extend a given view type, and want
  // to register all of that view types displays to yourself e.g. you create a
  // linear-genome-view subtype, and want all the tracks that are compatible
  // display types for the linear-genome-view to be compatible with your type
  // also (without this, display types are only registered to a single view
  // type)
  extendedName?: string

  constructor(stuff: {
    name: string
    ReactComponent: ViewReactComponent
    stateModel: IAnyModelType
    extendedName?: string
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.stateModel = stuff.stateModel
    this.extendedName = stuff.extendedName
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
