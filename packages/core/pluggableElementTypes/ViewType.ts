import { IAnyModelType, IAnyStateTreeNode } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import DisplayType from './DisplayType'

type ViewReactComponent = React.ComponentType<{
  // TODO: can we use AbstractViewModel here?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
  session?: IAnyStateTreeNode
}>

export default class ViewType extends PluggableElementBase {
  ReactComponent?: ViewReactComponent

  LazyReactComponent?: ViewReactComponent

  stateModel: IAnyModelType

  displayTypes: DisplayType[] = []

  constructor(
    stuff:
      | {
          name: string
          ReactComponent: ViewReactComponent
          stateModel: IAnyModelType
        }
      | {
          name: string
          LazyReactComponent: ViewReactComponent
          stateModel: IAnyModelType
        },
  ) {
    super(stuff)
    if ('ReactComponent' in stuff) {
      this.ReactComponent = stuff.ReactComponent
    } else {
      this.LazyReactComponent = stuff.LazyReactComponent
    }
    this.stateModel = stuff.stateModel
    if (!this.ReactComponent && !this.LazyReactComponent) {
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
