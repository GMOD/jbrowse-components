/* eslint curly:error */
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { AnyAdapter } from '../data_adapters/BaseAdapter'

export default class AdapterType extends PluggableElementBase {
  AdapterClass?: AnyAdapter

  getAdapterClass?: () => Promise<AnyAdapter>

  configSchema: AnyConfigurationSchemaType

  adapterCapabilities: string[]

  externalPluginName: string | undefined

  excludeFromTrackSelector: boolean

  constructor(
    stuff: {
      name: string
      configSchema: AnyConfigurationSchemaType
      adapterCapabilities?: string[]
      externalPluginName?: string
      excludeFromTrackSelector?: boolean
    } & (
      | { AdapterClass: AnyAdapter }
      | { getAdapterClass: () => Promise<AnyAdapter> }
    ),
  ) {
    super(stuff)
    if ('AdapterClass' in stuff) {
      this.AdapterClass = stuff.AdapterClass
    } else if ('getAdapterClass' in stuff) {
      this.getAdapterClass = stuff.getAdapterClass
    } else {
      throw new Error(
        `no AdapterClass or getAdapterClass is defined for adapter type ${this.name}`,
      )
    }
    this.configSchema = stuff.configSchema
    this.adapterCapabilities = stuff.adapterCapabilities || []

    this.externalPluginName = stuff.externalPluginName

    if (stuff.excludeFromTrackSelector === undefined) {
      this.excludeFromTrackSelector = false
    } else {
      this.excludeFromTrackSelector = stuff.excludeFromTrackSelector
    }
  }
}
