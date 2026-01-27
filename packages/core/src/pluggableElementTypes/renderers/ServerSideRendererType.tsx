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
  /**
   * Props passed only to the client-side React rendering component.
   * These are NOT sent to the worker - they stay client-side only.
   * Typically includes displayModel, event callbacks, etc.
   */
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

/**
 * Determines if results already contain pre-rendered HTML content.
 * When HTML is present, no React element needs to be created.
 */
function hasPreRenderedContent(res: ResultsSerialized) {
  return !!res.html
}

/**
 * Creates a React element for SVG export mode.
 * Returns undefined if content is already pre-rendered.
 */
function createSvgExportElement(
  res: ResultsSerialized,
  args: RenderArgs,
  ReactComponent: ServerSideRenderer['ReactComponent'],
  supportsSVG: boolean,
) {
  if (hasPreRenderedContent(res)) {
    return undefined
  }

  if (supportsSVG) {
    return <ReactComponent {...args} {...res} />
  }

  return (
    <text y="12" fill="black">
      SVG export not supported for this track
    </text>
  )
}

/**
 * Creates a React element for normal (non-export) rendering mode.
 */
function createNormalElement(
  res: ResultsSerialized,
  args: RenderArgs,
  ReactComponent: ServerSideRenderer['ReactComponent'],
  renderingProps?: Record<string, unknown>,
) {
  return <ReactComponent {...args} {...res} {...renderingProps} />
}

export default class ServerSideRenderer extends RendererType {
  /**
   * Renders directly without serialization. Used by MainThreadRpcDriver
   * to avoid unnecessary serialize/deserialize overhead when no worker
   * thread boundary is crossed.
   *
   * Key differences from renderInWorker + deserializeResultsInClient:
   * - Config stays as live MST node (no snapshot/create cycle)
   * - Features stay as Feature objects (no toJSON/fromJSON)
   * - RpcResult values are unwrapped directly
   */
  async renderDirect(args: RenderArgs) {
    const { renderingProps, ...rest } = args

    // Ensure config is an MST model for render() - it may be a plain object
    // if rendererConfig returns a plain object for performance
    const config = isStateTreeNode(args.config)
      ? args.config
      : this.configSchema.create(args.config || {}, {
          pluginManager: this.pluginManager,
        })

    const results = await this.render({
      ...rest,
      config,
    } as RenderArgsDeserialized)

    // For RpcResult (canvas renderers with transferables), unwrap directly
    // No need for transfer semantics since we're on the same thread
    if (isRpcResult(results)) {
      const unwrapped = (results as { value: ResultsSerialized }).value
      return this.deserializeResultsInClient(unwrapped, args)
    }

    // For non-RpcResult, we still need to create the React element
    // but we can skip feature serialization by passing results directly
    const { reactElement, ...resultRest } = results
    return {
      ...resultRest,
      reactElement: args.exportSVG
        ? createSvgExportElement(
            resultRest as ResultsSerialized,
            args,
            this.ReactComponent,
            this.supportsSVG,
          )
        : createNormalElement(
            resultRest as ResultsSerialized,
            args,
            this.ReactComponent,
            renderingProps,
          ),
    }
  }

  serializeArgsInClient(args: RenderArgs): RenderArgsSerialized {
    // strip renderingProps - they are client-side only and should not be
    // serialized to the worker
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
        ? createSvgExportElement(
            res,
            args,
            this.ReactComponent,
            this.supportsSVG,
          )
        : createNormalElement(res, args, this.ReactComponent, renderingProps),
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

    // If render() returned an rpcResult, it's already serialized - pass through
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
