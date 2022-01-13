import React from 'react'
import { ComponentType, LazyExoticComponent } from 'react'
import { IAnyModelType, IAnyStateTreeNode } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'

export default class WidgetType extends PluggableElementBase {
  heading?: string

  configSchema: AnyConfigurationSchemaType

  HeadingComponent?: ComponentType<{ model: IAnyStateTreeNode }>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ReactComponent: LazyExoticComponent<React.FC<any>> | React.FC<any>

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    heading?: string
    HeadingComponent?: ComponentType<{ model: IAnyStateTreeNode }>
    configSchema: AnyConfigurationSchemaType
    stateModel: IAnyModelType
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReactComponent: LazyExoticComponent<React.FC<any>> | React.FC<any>
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
