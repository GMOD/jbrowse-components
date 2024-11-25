import type { ComponentType, LazyExoticComponent } from 'react'
import type React from 'react'
import PluggableElementBase from './PluggableElementBase'
import type { AnyConfigurationSchemaType } from '../configuration'
import type { IAnyModelType, IAnyStateTreeNode } from 'mobx-state-tree'

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
