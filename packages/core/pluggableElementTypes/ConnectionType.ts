/* eslint-disable react/static-property-placement */
import { IAnyModelType, SnapshotIn } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import {
  AnyConfigurationSchemaType,
  AnyConfigurationModel,
} from '../configuration/configurationSchema'
import { AnyReactComponentType } from '../util'

export default class ConnectionType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  displayName: string

  description: string

  url: string

  getAssemblies: (
    connectionConfig: AnyConfigurationModel,
  ) => Promise<SnapshotIn<AnyConfigurationSchemaType>[]>

  configEditorComponent?: AnyReactComponentType

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    configSchema: AnyConfigurationSchemaType
    displayName: string
    description: string
    getAssemblies?(
      connectionConfig: AnyConfigurationModel,
    ): Promise<SnapshotIn<AnyConfigurationSchemaType>[]>
    configEditorComponent?: AnyReactComponentType
    url: string
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    this.displayName = stuff.displayName
    this.description = stuff.description
    this.url = stuff.url
    this.getAssemblies = stuff.getAssemblies || (() => Promise.resolve([]))

    this.configEditorComponent = stuff.configEditorComponent
    if (!this.stateModel)
      throw new Error(`no stateModel defined for connection ${this.name}`)
    if (!this.configSchema)
      throw new Error(`no configSchema defined for connection ${this.name}`)
  }
}
