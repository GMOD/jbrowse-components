import {
  checkAbortSignal,
  renameRegionsIfNeeded,
} from '@gmod/jbrowse-core/util'
import { getAdapter } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { RemoteAbortSignal } from '@gmod/jbrowse-core/rpc/remoteAbortSignals'
import RpcMethodType from '@gmod/jbrowse-core/pluggableElementTypes/RpcMethodType'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import ComparativeServerSideRendererType, {
  RenderArgs,
} from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'

interface ComparativeRenderArgs {
  sessionId: string
  adapterConfig: {}
  rendererType: string
  renderProps: RenderArgs
  signal?: RemoteAbortSignal
}

/**
 * call a synteny renderer with the given args
 * param views: a set of views that each contain a set of regions
 * used instead of passing regions directly as in render()
 */
export default class ComparativeRender extends RpcMethodType {
  async serializeArguments(
    args: ComparativeRenderArgs & { signal?: AbortSignal },
  ) {
    const assemblyManager = this.pluginManager.rootModel?.session
      ?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    return renameRegionsIfNeeded(assemblyManager, args)
  }

  async execute(args: ComparativeRenderArgs) {
    const {
      sessionId,
      adapterConfig,
      rendererType,
      renderProps,
      signal,
    } = await this.deserializeArguments(args)
    if (!sessionId) throw new Error('must pass a unique session id')

    checkAbortSignal(signal)

    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!(dataAdapter instanceof BaseFeatureDataAdapter))
      throw new Error(
        `ComparativeRender cannot handle this type of data adapter ${dataAdapter}`,
      )

    const RendererType = this.pluginManager.getRendererType(rendererType)

    if (!RendererType) {
      throw new Error(`renderer "${rendererType}" not found`)
    }
    if (!RendererType.ReactComponent) {
      throw new Error(
        `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
      )
    }

    if (!(RendererType instanceof ComparativeServerSideRendererType))
      throw new Error(
        'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
      )

    const result = await RendererType.renderInWorker({
      ...renderProps,
      sessionId,
      dataAdapter,
      signal,
    })
    checkAbortSignal(signal)
    return result
  }
}
