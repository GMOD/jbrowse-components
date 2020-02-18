import PluggableElementBase from './PluggableElementBase'

export default class ConnectionType extends PluggableElementBase {
  stateModel = undefined

  configSchema = undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(stuff: { name: string; stateModel: any; configSchema: any }) {
    super(stuff)
    if (!this.stateModel)
      throw new Error(`no stateModel defined for connection ${this.name}`)
    if (!this.configSchema)
      throw new Error(`no configSchema defined for connection ${this.name}`)
  }
}
