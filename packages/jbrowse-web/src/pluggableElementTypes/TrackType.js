import PluggableElementType from './PluggableElementBase'

export default class TrackType extends PluggableElementType {
  constructor(stuff, subClassDefaults = {}) {
    super(stuff, { compatibleView: 'LinearGenomeView' }, subClassDefaults)
    if (!this.stateModel)
      throw new Error(`no stateModel defined for track ${this.name}`)
    if (!this.configSchema)
      throw new Error(`no configSchema provided for track ${this.name}`)
    if (!this.configSchema.defaultValue.type)
      throw new Error(`${this.configSchema.name} is not explicitlyTyped`)
  }
}
