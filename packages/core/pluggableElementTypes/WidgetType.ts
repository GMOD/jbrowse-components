import { ComponentType, LazyExoticComponent } from 'react'
import { IAnyModelType, IAnyStateTreeNode } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'

export default class WidgetType extends PluggableElementBase {
  heading?: string

  configSchema: AnyConfigurationSchemaType

  HeadingComponent?: ComponentType<{ model: IAnyStateTreeNode }>

  LazyReactComponent: LazyExoticComponent<
    ComponentType<{ model: IAnyStateTreeNode; session: IAnyStateTreeNode }>
  >

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    heading?: string
    HeadingComponent?: ComponentType<{ model: IAnyStateTreeNode }>
    configSchema: AnyConfigurationSchemaType
    stateModel: IAnyModelType
    LazyReactComponent: LazyExoticComponent<
      ComponentType<{ model: IAnyStateTreeNode; session: IAnyStateTreeNode }>
    >
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
