import { createElement } from 'react'

import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import RenderResult from './RenderResult.tsx'
import RendererType from './RendererType.tsx'
import SvgRenderResult from './SvgRenderResult.tsx'
import SerializableFilterChain from './util/serializableFilterChain.ts'
import { getSerializedSvg, updateStatus } from '../../util/index.ts'
import { isRpcResult } from '../../util/rpc.ts'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '../../util/stopToken.ts'

import type { RenderResults } from './RendererType.tsx'
import type {
  RenderArgs,
  RenderArgsDeserialized,
  RenderArgsSerialized,
  ResultsDeserialized,
  ResultsSerialized,
  ResultsSerializedSvgExport,
} from './ServerSideRendererTypes.ts'
import type RpcManager from '../../rpc/RpcManager.ts'

export type {
  RenderArgs,
  RenderArgsDeserialized,
  RenderArgsSerialized,
  ResultsDeserialized,
  ResultsSerialized,
  ResultsSerializedSvgExport,
} from './ServerSideRendererTypes.ts'

function isCanvasRecordedSvgExport(
  e: ResultsSerialized,
): e is ResultsSerializedSvgExport {
  return 'canvasRecordedData' in e
}

export default class ServerSideRenderer extends RendererType {
  async renderDirect(args: RenderArgs) {
    const { renderingProps, ...rest } = args

    const config = isStateTreeNode(args.config)
      ? args.config
      : this.configSchema.create(args.config || {}, {
          pluginManager: this.pluginManager,
        })

    const results = await this.render({
      ...rest,
      config,
    } as RenderArgsDeserialized)

    if (isRpcResult(results)) {
      const unwrapped = (results as { value: ResultsSerialized }).value
      return this.deserializeResultsInClient(unwrapped, args)
    }

    const { reactElement, ...resultRest } = results
    return {
      ...resultRest,
      reactElement: args.exportSVG
        ? createElement(SvgRenderResult, {
            res: resultRest as ResultsSerialized,
            args,
            ReactComponent: this.ReactComponent,
            supportsSVG: this.supportsSVG,
          })
        : createElement(RenderResult, {
            res: resultRest as ResultsSerialized,
            args,
            ReactComponent: this.ReactComponent,
            renderingProps,
          }),
    }
  }

  serializeArgsInClient(args: RenderArgs): RenderArgsSerialized {
    const { renderingProps, ...rest } = args
    return {
      ...rest,
      config: isStateTreeNode(args.config)
        ? getSnapshot(args.config)
        : args.config,
      filters: args.filters?.toJSON().filters,
    }
  }

  deserializeResultsInClient(
    res: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    const { renderingProps } = args
    return {
      ...res,
      reactElement: args.exportSVG
        ? createElement(SvgRenderResult, {
            res,
            args,
            ReactComponent: this.ReactComponent,
            supportsSVG: this.supportsSVG,
          })
        : createElement(RenderResult, {
            res,
            args,
            ReactComponent: this.ReactComponent,
            renderingProps,
          }),
    }
  }

  deserializeArgsInWorker(args: RenderArgsSerialized): RenderArgsDeserialized {
    return {
      ...args,
      config: this.configSchema.create(args.config || {}, {
        pluginManager: this.pluginManager,
      }),
      filters: args.filters
        ? new SerializableFilterChain({
            filters: args.filters,
            jexl: this.pluginManager.jexl,
          })
        : undefined,
    }
  }

  serializeResultsInWorker(
    results: RenderResults & { imageData?: ImageBitmap },
    _args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const { reactElement, ...rest } = results
    return rest
  }

  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    const results = (await rpcManager.call(
      args.sessionId,
      'CoreRender',
      args,
    )) as ResultsSerialized

    if (isCanvasRecordedSvgExport(results)) {
      const { reactElement, ...rest } = results
      return {
        ...rest,
        html: await getSerializedSvg(results),
      }
    } else {
      return results
    }
  }

  async renderInWorker(args: RenderArgsSerialized): Promise<ResultsSerialized> {
    const { stopToken, statusCallback = () => {} } = args
    const stopTokenCheck = createStopTokenChecker(stopToken)
    const args2 = this.deserializeArgsInWorker(args)
    const results = await updateStatus('Rendering plot', statusCallback, () =>
      this.render({ ...args2, stopTokenCheck }),
    )
    checkStopToken2(stopTokenCheck)

    if (isRpcResult(results)) {
      return results as unknown as ResultsSerialized
    }

    return updateStatus('Serializing results', statusCallback, () =>
      this.serializeResultsInWorker(results, { ...args2, stopTokenCheck }),
    )
  }

  async freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)
    const { sessionId } = args

    await rpcManager.call(sessionId, 'CoreFreeResources', serializedArgs)
  }
}

export { type RenderResults, type RenderReturn } from './RendererType.tsx'
