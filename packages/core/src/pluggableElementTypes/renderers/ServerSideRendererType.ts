import { createElement } from 'react'

import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import RendererType from './RendererType.tsx'
import SerializableFilterChain from './util/serializableFilterChain.ts'
import { getSerializedSvg, updateStatus } from '../../util/index.ts'
import { isRpcResult } from '../../util/rpc.ts'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '../../util/stopToken.ts'

import type { RenderProps, RenderResults } from './RendererType.tsx'
import type { SerializedFilterChain } from './util/serializableFilterChain.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type RpcManager from '../../rpc/RpcManager.ts'
import type { LastStopTokenCheck } from '../../util/stopToken.ts'
import type { SnapshotIn, SnapshotOrInstance } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

interface BaseRenderArgs extends RenderProps {
  sessionId: string
  trackInstanceId: string
  stopToken?: string
  theme: ThemeOptions
  exportSVG?: {
    rasterizeLayers?: boolean
  }
}

export interface RenderArgs extends BaseRenderArgs {
  config: SnapshotOrInstance<AnyConfigurationModel>
  filters?: SerializableFilterChain
  renderingProps?: Record<string, unknown>
}

export interface RenderArgsSerialized extends BaseRenderArgs {
  statusCallback?: (arg: string) => void
  config: SnapshotIn<AnyConfigurationModel>
  filters?: SerializedFilterChain
}

export interface RenderArgsDeserialized extends BaseRenderArgs {
  config: AnyConfigurationModel
  filters?: SerializableFilterChain
  stopTokenCheck?: LastStopTokenCheck
}

export type ResultsSerialized = Omit<RenderResults, 'reactElement'> & {
  imageData?: ImageBitmap
}

export interface ResultsSerializedSvgExport extends ResultsSerialized {
  canvasRecordedData: unknown
  width: number
  height: number
  reactElement: unknown
}

export type ResultsDeserialized = RenderResults

function isCanvasRecordedSvgExport(
  e: ResultsSerialized,
): e is ResultsSerializedSvgExport {
  return 'canvasRecordedData' in e
}

export default class ServerSideRenderer extends RendererType {
  private createReactElement(res: ResultsSerialized, args: RenderArgs) {
    if (args.exportSVG) {
      if (res.html) {
        return undefined
      }
      if (this.supportsSVG) {
        return createElement(this.ReactComponent, { ...args, ...res })
      }
      return createElement(
        'text',
        { y: '12', fill: 'black' },
        'SVG export not supported for this track',
      )
    }
    return createElement(this.ReactComponent, {
      ...args,
      ...res,
      ...args.renderingProps,
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
