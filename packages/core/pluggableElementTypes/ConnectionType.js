import PluggableElementType from './PluggableElementBase'

export default class ConnectionType extends PluggableElementType {
  constructor(stuff) {
    super(stuff)
    if (!this.stateModel)
      throw new Error(`no stateModel defined for connection ${this.name}`)
    if (!this.configSchema)
      throw new Error(`no configSchema defined for connection ${this.name}`)
  }
}
