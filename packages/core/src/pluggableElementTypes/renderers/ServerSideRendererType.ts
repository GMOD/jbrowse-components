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
  private createReactElement(res: ResultsSerialized, args: RenderArgs) {
    return args.exportSVG
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
          renderingProps: args.renderingProps,
        })
  }

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
      return this.deserializeResultsInClient(
        (results as { value: ResultsSerialized }).value,
        args,
      )
    }

    const { reactElement, ...resultRest } = results
    return {
      ...resultRest,
      reactElement: this.createReactElement(
        resultRest as ResultsSerialized,
        args,
      ),
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
    return {
      ...res,
      reactElement: this.createReactElement(res, args),
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
    results: RenderResults,
    _args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const { reactElement, ...rest } = results
    return rest as ResultsSerialized
  }

  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    const results = (await rpcManager.call(
      args.sessionId,
      'CoreRender',
      args,
    )) as ResultsSerialized

    if (isCanvasRecordedSvgExport(results)) {
      const { reactElement, ...rest } = results
      return { ...rest, html: await getSerializedSvg(results) }
    }
    return results
  }

  async renderInWorker(args: RenderArgsSerialized): Promise<ResultsSerialized> {
    const { stopToken, statusCallback = () => {} } = args
    const stopTokenCheck = createStopTokenChecker(stopToken)
    const deserializedArgs = {
      ...this.deserializeArgsInWorker(args),
      stopTokenCheck,
    }

    const results = await updateStatus('Rendering plot', statusCallback, () =>
      this.render(deserializedArgs),
    )
    checkStopToken2(stopTokenCheck)

    if (isRpcResult(results)) {
      return results as unknown as ResultsSerialized
    }

    return updateStatus('Serializing results', statusCallback, () =>
      this.serializeResultsInWorker(results, deserializedArgs),
    )
  }

  async freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    await rpcManager.call(
      args.sessionId,
      'CoreFreeResources',
      this.serializeArgsInClient(args),
    )
  }
}

export { type RenderResults, type RenderReturn } from './RendererType.tsx'
