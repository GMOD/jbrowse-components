import {
  freeAdapterResources,
  getAdapter,
} from '../data_adapters/dataAdapterCache'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType'
import ServerSideRendererType, {
  RenderArgsSerialized,
} from '../pluggableElementTypes/renderers/ServerSideRendererType'
import { RemoteAbortSignal } from './remoteAbortSignals'
import {
  isRegionsAdapter,
  BaseFeatureDataAdapter,
  isRefNameAliasAdapter,
} from '../data_adapters/BaseAdapter'
import { Region } from '../util/types'
import { checkAbortSignal } from '../util'

export class CoreGetRegions extends RpcMethodType {
  async execute(args: {
    sessionId: string
    signal: RemoteAbortSignal
    adapterConfig: {}
  }) {
    const {
      sessionId,
      signal,
      adapterConfig,
    } = await this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
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
  async execute(args: {
    sessionId: string
    signal: RemoteAbortSignal
    adapterConfig: {}
  }) {
    const {
      sessionId,
      signal,
      adapterConfig,
    } = await this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      return dataAdapter.getRefNames({ signal })
    }
    return []
  }
}

export class CoreGetRefNameAliases extends RpcMethodType {
  async execute(args: {
    sessionId: string
    signal: RemoteAbortSignal
    adapterConfig: {}
  }) {
    const {
      sessionId,
      signal,
      adapterConfig,
    } = await this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
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
  async execute(specification: {}) {
    let deleteCount = 0

    deleteCount += freeAdapterResources(specification)

    // pass the freeResources hint along to all the renderers as well
    this.pluginManager.getRendererTypes().forEach(renderer => {
      const count = renderer.freeResources(specification)
      if (count) deleteCount += count
    })

    return deleteCount
  }
}

interface SerializedRenderArgs {
  assemblyName: string
  regions: Region[]
  sessionId: string
  adapterConfig: {}
  rendererType: string
  renderProps: RenderArgsSerialized
  signal?: RemoteAbortSignal
}

/**
 * call a renderer with the given args
 */
export class CoreRender extends RpcMethodType {
  async serializeArguments(args: SerializedRenderArgs) {
    const { assemblyName, signal, regions, adapterConfig } = args
    const newArgs: typeof args & {
      originalRegions?: Region[]
    } = {
      ...args,
      regions: [...(args.regions || [])],
    }
    if (assemblyName) {
      const app = this.pluginManager.rootModel?.jbrowse
      // if (app && typeof app.getRefNameMapForAdapter === 'function') {
      //   const refNameMap = await app.getRefNameMapForAdapter(
      //     adapterConfig,
      //     assemblyName,
      //     { signal },
      //   )

      //   if (regions && newArgs.regions) {
      //     for (let i = 0; i < regions.length; i += 1) {
      //       newArgs.originalRegions = args.regions
      //       newArgs.regions[i] =
      //         this.renameRegionIfNeeded(refNameMap, regions[i]) || regions[i]
      //     }
      //   }
      // }
    }

    return newArgs
  }

  async execute(args: SerializedRenderArgs) {
    const {
      regions,
      sessionId,
      adapterConfig,
      rendererType,
      renderProps,
      signal,
    } = await this.deserializeArguments(args)
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkAbortSignal(signal)

    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!(dataAdapter instanceof BaseFeatureDataAdapter))
      throw new Error(
        `CoreRender cannot handle this type of data adapter ${dataAdapter}`,
      )

    const RendererType = this.pluginManager.getRendererType(rendererType)
    if (!RendererType) throw new Error(`renderer "${rendererType}" not found`)
    if (!RendererType.ReactComponent)
      throw new Error(
        `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
      )

    if (!(RendererType instanceof ServerSideRendererType))
      throw new Error(
        'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
      )

    const result = await RendererType.renderInWorker({
      ...renderProps,
      sessionId,
      dataAdapter,
      regions,
      signal,
    })
    checkAbortSignal(signal)
    return result
  }
}
