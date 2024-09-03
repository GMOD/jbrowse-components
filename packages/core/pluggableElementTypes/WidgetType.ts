import React, { ComponentType, LazyExoticComponent } from 'react'
import { IAnyModelType, IAnyStateTreeNode } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration'

type WidgetComponentType = LazyExoticComponent<React.FC<any>> | React.FC<any>

type HeadingComponentType = ComponentType<{ model: IAnyStateTreeNode }>

export default class WidgetType extends PluggableElementBase {
  heading?: string

  configSchema: AnyConfigurationSchemaType

  HeadingComponent?: HeadingComponentType

  ReactComponent: WidgetComponentType

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    heading?: string
    HeadingComponent?: HeadingComponentType
    configSchema: AnyConfigurationSchemaType
    stateModel: IAnyModelType
    ReactComponent: WidgetComponentType
  }) {
    super(stuff)
    this.heading = stuff.heading
    this.HeadingComponent = stuff.HeadingComponent
    this.configSchema = stuff.configSchema
    this.stateModel = stuff.stateModel
    this.ReactComponent = stuff.ReactComponent
  }
}
