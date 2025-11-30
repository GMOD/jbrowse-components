import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'
import { getSerializedSvg, updateStatus } from '../../util'
import { checkStopToken } from '../../util/stopToken'

import type { RenderProps, RenderResults } from './RendererType'
import type { AnyConfigurationModel } from '../../configuration'
import type { SerializedFilterChain } from './util/serializableFilterChain'
import type RpcManager from '../../rpc/RpcManager'
import type { SnapshotIn, SnapshotOrInstance } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

interface BaseRenderArgs extends RenderProps {
  sessionId: string
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
        ? new SerializableFilterChain({ filters: args.filters })
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
    const args2 = this.deserializeArgsInWorker(args)
    const results = await updateStatus('Rendering plot', statusCallback, () =>
      this.render(args2),
    )
    checkStopToken(stopToken)

    // If render() returned an rpcResult, it's already serialized - pass through
    if (
      typeof results === 'object' &&
      '__rpcResult' in results &&
      results.__rpcResult === true
    ) {
      return results as unknown as ResultsSerialized
    }

    return updateStatus('Serializing results', statusCallback, () =>
      this.serializeResultsInWorker(results, args2),
    )
  }

  async freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)
    const { sessionId } = args

    await rpcManager.call(sessionId, 'CoreFreeResources', serializedArgs)
  }
}

export { type RenderResults } from './RendererType'
