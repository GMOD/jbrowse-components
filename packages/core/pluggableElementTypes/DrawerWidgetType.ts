import { ComponentType, Component } from 'react'
import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'

export default class DrawerWidgetType extends PluggableElementBase {
  heading?: string

  configSchema: AnyConfigurationSchemaType

  HeadingComponent?: ComponentType

  LazyReactComponent: any

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    heading?: string
    HeadingComponent?: ComponentType
    configSchema: AnyConfigurationSchemaType
    stateModel: IAnyModelType
    LazyReactComponent: any
  }) {
    super(stuff)
    this.heading = stuff.heading
    this.HeadingComponent = stuff.HeadingComponent
    this.configSchema = stuff.configSchema
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
