import PluggableElementType from './PluggableElementBase'

export default class AdapterType extends PluggableElementType {
  constructor(stuff, subClassDefaults = {}) {
    super(stuff, subClassDefaults)
    if (!this.AdapterClass)
      throw new Error(`no AdapterClass defined for adapter type ${this.name}`)
  }
}
