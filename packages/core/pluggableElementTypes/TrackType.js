import PluggableElementType from './PluggableElementBase'
import { getDefaultValue } from '../util/mst-reflection'

export default class TrackType extends PluggableElementType {
  constructor(stuff, subClassDefaults = {}) {
    super(stuff, { compatibleView: 'LinearGenomeView' }, subClassDefaults)
    if (!this.stateModel) { throw new Error(`no stateModel defined for track ${this.name}`) }
    if (!this.configSchema) { throw new Error(`no configSchema provided for track ${this.name}`) }
    if (!getDefaultValue(this.configSchema).type) { throw new Error(`${this.configSchema.name} is not explicitlyTyped`) }
  }
}
