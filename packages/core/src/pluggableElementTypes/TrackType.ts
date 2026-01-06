import PluggableElementBase from './PluggableElementBase.ts'

import type DisplayType from './DisplayType.ts'
import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

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
