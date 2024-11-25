import type React from 'react'
import PluggableElementBase from './PluggableElementBase'
import type DisplayType from './DisplayType'
import type { IAnyModelType, IAnyStateTreeNode } from 'mobx-state-tree'

type BasicView = React.ComponentType<{
  // TODO: can we use AbstractViewModel here?

  model: any
  session?: IAnyStateTreeNode
}>

type ViewComponentType = React.LazyExoticComponent<BasicView> | BasicView

interface ViewMetadata {
  hiddenFromGUI?: boolean
}

export default class ViewType extends PluggableElementBase {
  ReactComponent: ViewComponentType

  stateModel: IAnyModelType

  displayTypes: DisplayType[] = []

  viewMetadata: ViewMetadata = {}

  // extendedName can be used for when you extend a given view type, and want
  // to register all of that view types displays to yourself
  //
  // e.g. you create a linear-genome-view subtype, and want all the tracks that
  // are compatible display types for the linear-genome-view to be compatible
  // with your type also (without this, display types are only registered to a
  // single view type)
  extendedName?: string

  constructor(stuff: {
    name: string
    displayName?: string
    stateModel: IAnyModelType
    extendedName?: string
    viewMetadata?: ViewMetadata
    ReactComponent: ViewComponentType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.viewMetadata = stuff.viewMetadata || {}
    this.stateModel = stuff.stateModel
    this.extendedName = stuff.extendedName
  }

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
