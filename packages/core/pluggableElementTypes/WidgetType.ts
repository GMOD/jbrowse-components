import { ComponentType } from 'react'
import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'

export default class WidgetType extends PluggableElementBase {
  heading?: string

  configSchema: AnyConfigurationSchemaType

  HeadingComponent?: ComponentType

  ReactComponent: unknown

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    heading?: string
    HeadingComponent?: ComponentType
    configSchema: AnyConfigurationSchemaType
    stateModel: IAnyModelType
    ReactComponent: unknown
  }) {
    super(stuff)
    this.heading = stuff.heading
    this.HeadingComponent = stuff.HeadingComponent
    this.configSchema = stuff.configSchema
    this.stateModel = stuff.stateModel
    this.ReactComponent = stuff.ReactComponent
    if (!this.ReactComponent) {
      throw new Error(`no ReactComponent defined for widget ${this.name}`)
    }
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for widget ${this.name}`)
    }
  }
}
