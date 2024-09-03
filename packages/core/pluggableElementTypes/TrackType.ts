import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration'
import DisplayType from './DisplayType'

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
