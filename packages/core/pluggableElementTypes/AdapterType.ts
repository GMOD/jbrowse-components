/* eslint curly:error */
import PluggableElementBase from './PluggableElementBase'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { AnyAdapter } from '../data_adapters/BaseAdapter'

interface TrackConfig {
  [key: string]: unknown
  excludeFromTrackSelector?: boolean
  adapterCategoryHeader?: string
  regexGuess?: RegExp | undefined
  trackGuess?: string | undefined
  fetchConfig?: Function
}

export default class AdapterType extends PluggableElementBase {
  AdapterClass?: AnyAdapter

  getAdapterClass?: () => Promise<AnyAdapter>

  configSchema: AnyConfigurationSchemaType

  adapterCapabilities: string[]

  addTrackConfig: TrackConfig

  constructor(
    stuff: {
      name: string
      configSchema: AnyConfigurationSchemaType
      adapterCapabilities?: string[]
      addTrackConfig?: TrackConfig
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

    if (stuff.addTrackConfig) {
      this.addTrackConfig = stuff.addTrackConfig
    } else {
      this.addTrackConfig = {
        excludeFromTrackSelector: false,
      }
    }
  }
}
