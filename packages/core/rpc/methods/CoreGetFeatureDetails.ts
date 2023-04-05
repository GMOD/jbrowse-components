/* eslint-disable @typescript-eslint/no-non-null-assertion */
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'
import { RenderArgs } from './util'
import { RemoteAbortSignal } from '../remoteAbortSignals'
import { renameRegionsIfNeeded, getLayoutId } from '../../util'
import { RenderArgsSerialized, validateRendererType } from './util'

/**
 * fetches features from an adapter and call a renderer with them
 */
export default class CoreGetFeatureDetails extends RpcMethodType {
  name = 'CoreGetFeatureDetails'

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    const superArgs = (await super.serializeArguments(
      renamedArgs,
      rpcDriver,
    )) as RenderArgs
    if (rpcDriver === 'MainThreadRpcDriver') {
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
    rpcDriver: string,
  ) {
    let deserializedArgs = args
    if (rpcDriver !== 'MainThreadRpcDriver') {
      deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    }
    const { rendererType, featureId } = deserializedArgs
    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )

    // @ts-expect-error
    const sess = RendererType.sessions[getLayoutId(args)]
    const { layout } = sess.cachedLayout
    const xref = layout.getDataByID(featureId)

    return { feature: xref.toJSON() }
  }
}
