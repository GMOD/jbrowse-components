import { ComponentType as ReactComponentType } from 'react'
import PluggableElementBase from './PluggableElementBase'

export default class MenuBarType extends PluggableElementBase {
  LazyReactComponent: ReactComponentType

  stateModel: any

  constructor(stuff: {
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stateModel: any
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
