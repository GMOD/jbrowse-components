import PluggableElementBase from './PluggableElementBase'
import type { AnyConfigurationSchemaType } from '../configuration'
import type DisplayType from './DisplayType'
import type { IAnyModelType } from 'mobx-state-tree'

export default class TrackType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  displayTypes: DisplayType[] = []

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    displayName?: string
    configSchema: AnyConfigurationSchemaType
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
  }

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
