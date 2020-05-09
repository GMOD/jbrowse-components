import {
  freeAdapterResources,
  getAdapter,
} from '../data_adapters/dataAdapterCache'
import PluginManager from '../PluginManager'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType'
import { RemoteAbortSignal } from './remoteAbortSignals'
import {
  isRegionsAdapter,
  BaseFeatureDataAdapter,
  isRefNameAliasAdapter,
} from '../data_adapters/BaseAdapter'

export class CoreGetRegions extends RpcMethodType {
  async execute(
    pluginManager: PluginManager,
    args: {
      sessionId: string
      adapterType: string
      signal: RemoteAbortSignal
      adapterConfig: {}
    },
  ) {
    const {
      sessionId,
      adapterType,
      signal,
      adapterConfig,
    } = this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      pluginManager,
      sessionId,
      adapterType,
      adapterConfig,
    )
    if (
      dataAdapter instanceof BaseFeatureDataAdapter &&
      isRegionsAdapter(dataAdapter)
    ) {
      return dataAdapter.getRegions({ signal })
    }
    return []
  }
}

export class CoreGetRefNames extends RpcMethodType {
  async execute(
    pluginManager: PluginManager,
    args: {
      sessionId: string
      signal: RemoteAbortSignal
      adapterType: string
      adapterConfig: {}
    },
  ) {
    const {
      sessionId,
      signal,
      adapterType,
      adapterConfig,
    } = this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      pluginManager,
      sessionId,
      adapterType,
      adapterConfig,
    )
    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      return dataAdapter.getRefNames({ signal })
    }
    return []
  }
}

export class CoreGetRefNameAliases extends RpcMethodType {
  async execute(
    pluginManager: PluginManager,
    args: {
      sessionId: string
      adapterType: string
      signal: RemoteAbortSignal
      adapterConfig: {}
    },
  ) {
    const {
      sessionId,
      adapterType,
      signal,
      adapterConfig,
    } = this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      pluginManager,
      sessionId,
      adapterType,
      adapterConfig,
    )
    if (isRefNameAliasAdapter(dataAdapter)) {
      return dataAdapter.getRefNameAliases({ signal })
    }
    return []
  }
}

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export class CoreFreeResources extends RpcMethodType {
  async execute(pluginManager: PluginManager, specification: {}) {
    let deleteCount = 0

    deleteCount += freeAdapterResources(specification)

    // pass the freeResources hint along to all the renderers as well
    pluginManager.getRendererTypes().forEach(renderer => {
      const count = renderer.freeResources(specification)
      if (count) deleteCount += count
    })

    return deleteCount
  }
}
