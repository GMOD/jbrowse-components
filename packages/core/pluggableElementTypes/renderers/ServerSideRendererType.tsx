import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'

import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'
import { convertSvgExportToHtml, isSvgExport } from './util/svgExportUtils'
import { updateStatus } from '../../util'
import { checkStopToken } from '../../util/stopToken'

import type { RenderProps, RenderResults } from './RendererType'
import type { AnyConfigurationModel } from '../../configuration'
import type { SerializedFilterChain } from './util/serializableFilterChain'
import type RpcManager from '../../rpc/RpcManager'
import type { RasterizedImageData } from '../../util'
import type { ThemeOptions } from '@mui/material'
import type { SnapshotIn, SnapshotOrInstance } from 'mobx-state-tree'

const RPC_METHOD_RENDER = 'CoreRender'
const RPC_METHOD_FREE_RESOURCES = 'CoreFreeResources'
const STATUS_RENDERING = 'Rendering plot'
const STATUS_SERIALIZING = 'Serializing results'

const SVG_NOT_SUPPORTED_MESSAGE =
  '<text y="12" fill="black">SVG export not supported for this track</text>'

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

export interface ResultsSerializedBase
  extends Omit<RenderResults, 'reactElement'> {
  type?: string
  html: string
}

export interface ResultsSerializedNormal extends ResultsSerializedBase {
  type: 'normal'
}

export interface ResultsSerializedSvgVector extends ResultsSerializedBase {
  type: 'svg-vector'
  canvasRecordedData: unknown
  width: number
  height: number
}

export interface ResultsSerializedSvgRaster extends ResultsSerializedBase {
  type: 'svg-raster'
  rasterizedImageData: RasterizedImageData
  width: number
  height: number
}

export type ResultsSerialized =
  | ResultsSerializedNormal
  | ResultsSerializedSvgVector
  | ResultsSerializedSvgRaster

export type ResultsDeserialized = RenderResults

export default class ServerSideRenderer extends RendererType {
  serializeArgsInClient(args: RenderArgs): RenderArgsSerialized {
    const config = isStateTreeNode(args.config)
      ? getSnapshot(args.config)
      : args.config

    const filters = args.filters?.toJSON().filters

    return {
      ...args,
      config,
      filters,
    }
  }

  deserializeResultsInClient(
    res: ResultsSerializedBase,
    args: RenderArgs,
  ): ResultsDeserialized {
    if (!this.supportsSVG) {
      return {
        ...res,
        html: SVG_NOT_SUPPORTED_MESSAGE,
      }
    }

    if (isSvgExport(res)) {
      return res
    }

    return {
      ...res,
      reactElement: <this.ReactComponent {...args} {...res} />,
    }
  }

  deserializeArgsInWorker(args: RenderArgsSerialized): RenderArgsDeserialized {
    const config = this.configSchema.create(args.config || {}, {
      pluginManager: this.pluginManager,
    })

    const filters = args.filters
      ? new SerializableFilterChain({ filters: args.filters })
      : undefined

    return {
      ...args,
      config,
      filters,
    }
  }

  serializeResultsInWorker(
    results: RenderResults,
    _args: RenderArgsDeserialized,
  ): ResultsSerializedBase {
    const { reactElement, ...serializedResults } = results

    const resultsWithType = serializedResults as Partial<ResultsSerializedBase>
    const type = resultsWithType.type || 'normal'

    return {
      ...serializedResults,
      type,
      html: resultsWithType.html || '',
    } as ResultsSerializedBase
  }

  async renderInClient(
    rpcManager: RpcManager,
    args: RenderArgs,
  ): Promise<ResultsSerializedBase> {
    const results = (await rpcManager.call(
      args.sessionId,
      RPC_METHOD_RENDER,
      args,
    )) as ResultsSerializedBase

    return convertSvgExportToHtml(results)
  }

  async renderInWorker(
    args: RenderArgsSerialized,
  ): Promise<ResultsSerializedBase> {
    const { stopToken, statusCallback = () => {} } = args
    const deserializedArgs = this.deserializeArgsInWorker(args)

    const results = await updateStatus(STATUS_RENDERING, statusCallback, () =>
      this.render(deserializedArgs),
    )

    checkStopToken(stopToken)

    return updateStatus(STATUS_SERIALIZING, statusCallback, () =>
      this.serializeResultsInWorker(results, deserializedArgs),
    )
  }

  async freeResourcesInClient(
    rpcManager: RpcManager,
    args: RenderArgs,
  ): Promise<void> {
    const serializedArgs = this.serializeArgsInClient(args)

    await rpcManager.call(
      args.sessionId,
      RPC_METHOD_FREE_RESOURCES,
      serializedArgs,
    )
  }
}

export { type RenderResults } from './RendererType'
