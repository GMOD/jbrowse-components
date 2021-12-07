import { toArray } from 'rxjs/operators'
import {
  freeAdapterResources,
  getAdapter,
} from '../data_adapters/dataAdapterCache'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType'
import ServerSideRendererType, {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
} from '../pluggableElementTypes/renderers/ServerSideRendererType'
import { RemoteAbortSignal } from './remoteAbortSignals'
import {
  AnyDataAdapter,
  BaseFeatureDataAdapter,
  isFeatureAdapter,
} from '../data_adapters/BaseAdapter'
import { Region } from '../util/types'
import { checkAbortSignal, renameRegionsIfNeeded } from '../util'
import SimpleFeature, { SimpleFeatureSerialized } from '../util/simpleFeature'
import { BaseFeatureStats } from '../util/stats'

export class CoreGetRefNames extends RpcMethodType {
  name = 'CoreGetRefNames'

  async execute(
    args: {
      sessionId: string
      signal: RemoteAbortSignal
      adapterConfig: {}
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { sessionId, adapterConfig } = deserializedArgs
    let dataAdapter: AnyDataAdapter
    try {
      ;({ dataAdapter } = await getAdapter(
        this.pluginManager,
        sessionId,
        adapterConfig,
      ))
    } catch (error) {
      return []
    }

    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      return dataAdapter.getRefNames(deserializedArgs)
    }
    return []
  }
}

export class CoreGetFileInfo extends RpcMethodType {
  name = 'CoreGetInfo'

  async execute(
    args: {
      sessionId: string
      signal: RemoteAbortSignal
      adapterConfig: {}
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { sessionId, adapterConfig } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    return isFeatureAdapter(dataAdapter)
      ? dataAdapter.getHeader(deserializedArgs)
      : null
  }
}

export class CoreGetMetadata extends RpcMethodType {
  name = 'CoreGetMetadata'

  async execute(
    args: {
      sessionId: string
      signal: RemoteAbortSignal
      adapterConfig: {}
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { sessionId, adapterConfig } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    return isFeatureAdapter(dataAdapter)
      ? dataAdapter.getMetadata(deserializedArgs)
      : null
  }
}

export class CoreGetFeatures extends RpcMethodType {
  name = 'CoreGetFeatures'

  async deserializeReturn(
    feats: SimpleFeatureSerialized[],
    args: unknown,
    rpcDriverClassName: string,
  ) {
    const superDeserialized = (await super.deserializeReturn(
      feats,
      args,
      rpcDriverClassName,
    )) as SimpleFeatureSerialized[]
    return superDeserialized.map(feat => new SimpleFeature(feat))
  }

  async execute(
    args: {
      sessionId: string
      region: Region
      adapterConfig: {}
      signal?: RemoteAbortSignal
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opts?: any
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { signal, sessionId, adapterConfig, region, opts } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!isFeatureAdapter(dataAdapter)) {
      return []
    }
    const ret = dataAdapter.getFeatures(region, { ...opts, signal })
    const r = await ret.pipe(toArray()).toPromise()
    return r.map(f => f.toJSON())
  }
}

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export class CoreFreeResources extends RpcMethodType {
  name = 'CoreFreeResources'

  async execute(specification: {}) {
    let deleteCount = 0

    deleteCount += freeAdapterResources(specification)

    // pass the freeResources hint along to all the renderers as well
    this.pluginManager.getRendererTypes().forEach(renderer => {
      const count = renderer.freeResources(/* specification */)
      if (count) {
        deleteCount += count
      }
    })

    return deleteCount
  }
  async serializeArguments(args: {}, _rpcDriverClassName: string): Promise<{}> {
    return args
  }
}

export interface RenderArgs extends ServerSideRenderArgs {
  adapterConfig: {}
  rendererType: string
}

export interface RenderArgsSerialized extends ServerSideRenderArgsSerialized {
  assemblyName: string
  regions: Region[]
  adapterConfig: {}
  rendererType: string
}

export class CoreGetGlobalStats extends RpcMethodType {
  name = 'CoreGetGlobalStats'

  async serializeArguments(
    args: RenderArgs & { signal?: AbortSignal; statusCallback?: Function },
    rpcDriverClassName: string,
  ) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      return args
    }
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, {
      ...args,
      filters: args.filters && args.filters.toJSON().filters,
    })

    return super.serializeArguments(renamedArgs, rpcDriverClassName)
  }

  async execute(
    args: {
      adapterConfig: {}
      regions: Region[]
      signal?: RemoteAbortSignal
      headers?: Record<string, string>
      sessionId: string
    },
    rpcDriverClassName: string,
  ): Promise<BaseFeatureStats> {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )

    const { adapterConfig, sessionId, regions } = deserializedArgs
    let dataAdapter: AnyDataAdapter
    try {
      ;({ dataAdapter } = await getAdapter(
        this.pluginManager,
        sessionId,
        adapterConfig,
      ))
    } catch (error) {
      return { featureDensity: 0 }
    }

    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      return dataAdapter.getGlobalStats(regions[0], deserializedArgs)
    }
    throw new Error('Data adapter not found')
  }
}

/**
 * fetches features from an adapter and call a renderer with them
 */
export class CoreRender extends RpcMethodType {
  name = 'CoreRender'

  async serializeArguments(args: RenderArgs, rpcDriverClassName: string) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    const renamedArgs = assemblyManager
      ? await renameRegionsIfNeeded(assemblyManager, args)
      : args

    const superArgs = (await super.serializeArguments(
      renamedArgs,
      rpcDriverClassName,
    )) as RenderArgs
    if (rpcDriverClassName === 'MainThreadRpcDriver') {
      return superArgs
    }

    const { rendererType } = args

    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )

    return RendererType.serializeArgsInClient(superArgs)
  }

  async execute(
    args: RenderArgsSerialized & { signal?: RemoteAbortSignal },
    rpcDriverClassName: string,
  ) {
    let deserializedArgs = args
    if (rpcDriverClassName !== 'MainThreadRpcDriver') {
      deserializedArgs = await this.deserializeArguments(
        args,
        rpcDriverClassName,
      )
    }
    const { sessionId, rendererType, signal } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkAbortSignal(signal)

    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )

    const result =
      rpcDriverClassName === 'MainThreadRpcDriver'
        ? await RendererType.render(deserializedArgs)
        : await RendererType.renderInWorker(deserializedArgs)

    checkAbortSignal(signal)
    return result
  }

  async deserializeReturn(
    serializedReturn: RenderResults | ResultsSerialized,
    args: RenderArgs,
    rpcDriverClassName: string,
  ): Promise<unknown> {
    const superDeserialized = await super.deserializeReturn(
      serializedReturn,
      args,
      rpcDriverClassName,
    )
    if (rpcDriverClassName === 'MainThreadRpcDriver') {
      return superDeserialized
    }

    const { rendererType } = args
    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )
    return RendererType.deserializeResultsInClient(
      superDeserialized as ResultsSerialized,
      args,
    )
  }
}

function validateRendererType<T>(rendererType: string, RendererType: T) {
  if (!RendererType) {
    throw new Error(`renderer "${rendererType}" not found`)
  }
  // @ts-ignore
  if (!RendererType.ReactComponent) {
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )
  }

  if (!(RendererType instanceof ServerSideRendererType)) {
    throw new Error(
      'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
    )
  }
  return RendererType
}
