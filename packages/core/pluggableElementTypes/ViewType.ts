/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentType as ReactComponent } from 'react'
import PluggableElementBase from './PluggableElementBase'

export default class ViewType extends PluggableElementBase {
  ReactComponent: ReactComponent

  stateModel: any

  constructor(stuff: {
    name: string
    ReactComponent: ReactComponent
    stateModel: any
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
