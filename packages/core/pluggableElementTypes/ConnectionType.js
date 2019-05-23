import { getPropertyMembers } from 'mobx-state-tree'
import PluggableElementType from './PluggableElementBase'

export default class ConnectionType extends PluggableElementType {
  constructor(stuff) {
    super(stuff)
    if (!this.stateModel)
      throw new Error(`no stateModel defined for connection ${this.name}`)
    if (!getPropertyMembers(this.stateModel).properties.assemblies)
      throw new Error(
        `stateModel for connection ${this.name} must define "assemblies"`,
      )
    if (!this.configSchema)
      throw new Error(`no configSchema defined for connection ${this.name}`)
  }
}
