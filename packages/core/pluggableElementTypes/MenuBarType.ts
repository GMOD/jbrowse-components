import { Component as ReactComponent } from 'react'
import PluggableElementBase from './PluggableElementBase'

export default class MenuBarType extends PluggableElementBase {
  LazyReactComponent = undefined

  stateModel = undefined

  constructor(stuff: {
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stateModel: any
    LazyReactComponent: ReactComponent
  }) {
    super(stuff)
    if (!this.LazyReactComponent) {
      throw new Error(
        `no LazyReactComponent defined for drawer widget ${this.name}`,
      )
    }
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for drawer widget ${this.name}`)
    }
  }
}
