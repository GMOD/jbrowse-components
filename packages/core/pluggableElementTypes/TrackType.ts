/* eslint-disable @typescript-eslint/no-explicit-any */
import PluggableElementBase from './PluggableElementBase'
import { getDefaultValue } from '../util/mst-reflection'

export default class TrackType extends PluggableElementBase {
  compatibleView = 'LinearGenomeView'

  stateModel: any

  configSchema: any

  constructor(stuff: {
    name: string
    stateModel: any
    configSchema: any
    compatibleView: string
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for track ${this.name}`)
    }
    if (!this.configSchema) {
      throw new Error(`no configSchema provided for track ${this.name}`)
    }
    if (!getDefaultValue(this.configSchema).type) {
      const name = this.configSchema ? this.configSchema.name : 'UNKNOWN'
      throw new Error(`${name} is not explicitlyTyped`)
    }
  }
}
