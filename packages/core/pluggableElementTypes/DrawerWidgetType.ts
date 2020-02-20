import { ComponentType as ReactComponentType } from 'react'
import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { ConfigurationSchemaType } from '../configuration/configurationSchema'

export default class DrawerWidgetType extends PluggableElementBase {
  heading: string

  configSchema: ConfigurationSchemaType

  LazyReactComponent: ReactComponentType

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    heading: string
    configSchema: ConfigurationSchemaType
    stateModel: IAnyModelType
    LazyReactComponent: ReactComponentType
  }) {
    super(stuff)
    this.heading = stuff.heading
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
