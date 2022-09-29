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

  // allows for views that are 'extended' from other views to be added as a new view type in the plugin manager
  // without this, the plugin manager cannot distinguish whether relevant displays have been added to the view type's list
  // and thus will not display tracks that should be accessible within a view that has been extended from another
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
