import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import type {
  DotplotRenderArgs,
  RenderArgsSerialized,
  ResultsSerialized,
} from '../DotplotRenderer/DotplotRenderer'
import type DotplotRenderer from '../DotplotRenderer/DotplotRenderer'
import type { RenderResults } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'

interface RenderArgs extends DotplotRenderArgs {
  rendererType: string
}

interface RenderArgsSerializedWithRenderer extends RenderArgsSerialized {
  adapterConfig: Record<string, unknown>
  rendererType: string
}

export default class ComparativeRender extends RpcMethodType {
  name = 'ComparativeRender'

  async renameRegionsIfNeeded(args: RenderArgs, rend: DotplotRenderer) {
    return rend.renameRegionsIfNeeded(args)
  }

  getRenderer(rendererType: string) {
    const pm = this.pluginManager
    return pm.getRendererType(rendererType) as DotplotRenderer
  }

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const { rendererType } = args
    const renderer = this.getRenderer(rendererType)
    const n = (await super.serializeArguments(args, rpcDriver)) as RenderArgs
    const result = await this.renameRegionsIfNeeded(n, renderer)

    return renderer.serializeArgsInClient(result)
  }

  async execute(
    args: RenderArgsSerializedWithRenderer & { stopToken?: string },
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { sessionId, rendererType, stopToken } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkStopToken(stopToken)

    const renderer = this.getRenderer(rendererType)
    return renderer.renderInWorker(deserializedArgs)
  }

  async deserializeReturn(
    val: RenderResults | ResultsSerialized,
    args: RenderArgs,
    rpcDriver: string,
  ): Promise<unknown> {
    const ret = (await super.deserializeReturn(
      val,
      args,
      rpcDriver,
    )) as ResultsSerialized

    const renderer = this.getRenderer(args.rendererType)
    return renderer.deserializeResultsInClient(ret, args)
  }
}
