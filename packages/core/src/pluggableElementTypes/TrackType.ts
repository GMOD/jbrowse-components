import PluggableElementBase from './PluggableElementBase.ts'

import type DisplayType from './DisplayType.ts'
import type { TrackConfigSchema } from './models/baseTrackConfig.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export default class TrackType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: TrackConfigSchema

  displayTypes: DisplayType[] = []

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    displayName?: string
    configSchema: TrackConfigSchema
    aliases?: string[]
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
  }

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
