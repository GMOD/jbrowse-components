import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { IAnyModelType, IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ComponentType, LazyExoticComponent } from 'react'
import type React from 'react'

type WidgetComponentType = LazyExoticComponent<React.FC<any>> | React.FC<any>

type HeadingComponentType = ComponentType<{ model: IAnyStateTreeNode }>

export default class WidgetType extends PluggableElementBase {
  heading?: string

  configSchema: AnyConfigurationSchemaType

  HeadingComponent?: HeadingComponentType

  ReactComponent: WidgetComponentType

  stateModel: IAnyModelType

  helpText?: React.ReactNode

  /**
   * Closing the widget removes it from the session rather than hiding it, so
   * what it holds stops riding along in every saved and shared session (#3538)
   */
  discardOnClose: boolean

  constructor(stuff: {
    name: string
    heading?: string
    HeadingComponent?: HeadingComponentType
    configSchema: AnyConfigurationSchemaType
    stateModel: IAnyModelType
    ReactComponent: WidgetComponentType
    helpText?: React.ReactNode
    discardOnClose?: boolean
  }) {
    super(stuff)
    this.heading = stuff.heading
    this.HeadingComponent = stuff.HeadingComponent
    this.configSchema = stuff.configSchema
    this.stateModel = stuff.stateModel
    this.ReactComponent = stuff.ReactComponent
    this.helpText = stuff.helpText
    this.discardOnClose = stuff.discardOnClose ?? false
  }
}
