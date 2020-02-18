import PluggableElementBase from './PluggableElementBase'
import BaseAdapter from '../BaseAdapter'

export default class AdapterType extends PluggableElementBase {
  AdapterClass: typeof BaseAdapter

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stuff: {
      name: string
      AdapterClass: typeof BaseAdapter
      configSchema: any
    },
  ) {
    super(stuff)
    this.AdapterClass = stuff.AdapterClass
    if (!this.AdapterClass) {
      throw new Error(`no AdapterClass defined for adapter type ${this.name}`)
    }

    if (!this.AdapterClass.capabilities.length) {
      throw new Error(
        `Adapter class ${this.AdapterClass.name} must provide a static property "capabilities" that has at least one entry. See BaseAdapter for an example.`,
      )
    }
  }
}
