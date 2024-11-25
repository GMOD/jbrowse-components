import PluggableElementBase from './PluggableElementBase'
import type { AnyConfigurationSchemaType } from '../configuration'
import type { AnyReactComponentType } from '../util'
import type { IAnyModelType } from 'mobx-state-tree'

export default class ConnectionType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  description: string

  url: string

  configEditorComponent?: AnyReactComponentType

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    configSchema: AnyConfigurationSchemaType
    displayName: string
    description: string
    configEditorComponent?: AnyReactComponentType
    url: string
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    this.description = stuff.description
    this.url = stuff.url
    this.configEditorComponent = stuff.configEditorComponent
  }
}
