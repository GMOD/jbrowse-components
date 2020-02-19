/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentType as ReactComponentType } from 'react'
import PluggableElementBase from './PluggableElementBase'

export default class DrawerWidgetType extends PluggableElementBase {
  LazyReactComponent: ReactComponentType

  stateModel: any

  constructor(stuff: {
    name: string
    stateModel: any
    LazyReactComponent: ReactComponentType
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.LazyReactComponent = stuff.LazyReactComponent
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
