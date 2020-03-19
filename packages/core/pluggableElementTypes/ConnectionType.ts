/* eslint-disable react/static-property-placement */
import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'

export default class ConnectionType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  displayName: string

  description: string

  url: string

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    configSchema: AnyConfigurationSchemaType
    displayName: string
    description: string
    url: string
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    this.displayName = stuff.displayName
    this.description = stuff.description
    this.url = stuff.url
    if (!this.stateModel)
      throw new Error(`no stateModel defined for connection ${this.name}`)
    if (!this.configSchema)
      throw new Error(`no configSchema defined for connection ${this.name}`)
  }
}
