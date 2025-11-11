import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'

import RendererType from './RendererType'
import ServerSideRenderedContent from './ServerSideRenderedContent'
import SerializableFilterChain from './util/serializableFilterChain'
import { getSerializedSvg, updateStatus } from '../../util'
import { checkStopToken } from '../../util/stopToken'

import type { RenderProps, RenderResults } from './RendererType'
import type { AnyConfigurationModel } from '../../configuration'
import type { SerializedFilterChain } from './util/serializableFilterChain'
import type RpcManager from '../../rpc/RpcManager'
import type { ThemeOptions } from '@mui/material'
import type { SnapshotIn, SnapshotOrInstance } from 'mobx-state-tree'

// RPC method names
const RPC_METHOD_RENDER = 'CoreRender'
const RPC_METHOD_FREE_RESOURCES = 'CoreFreeResources'

// Status messages
const STATUS_RENDERING = 'Rendering plot'
const STATUS_SERIALIZING = 'Serializing results'

// SVG export not supported message
const SVG_NOT_SUPPORTED_MESSAGE =
  '<text y="12" fill="black">SVG export not supported for this track</text>'

interface BaseRenderArgs extends RenderProps {
  sessionId: string
  // Note that stopToken serialization happens after serializeArgsInClient and
  // deserialization happens before deserializeArgsInWorker
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

export interface ResultsSerialized extends Omit<RenderResults, 'reactElement'> {
  html: string
}

export interface ResultsSerializedSvgExport extends ResultsSerialized {
  canvasRecordedData: unknown
  width: number
  height: number
  reactElement: unknown
}

export type ResultsDeserialized = RenderResults

function isSvgExport(e: ResultsSerialized): e is ResultsSerializedSvgExport {
  return 'canvasRecordedData' in e
}

export default class ServerSideRenderer extends RendererType {
  /**
   * Serializes the render arguments to prepare them for transmission to the worker.
   * Converts config to snapshot if it's a state tree node, and serializes filters.
   *
   * @param args - the arguments passed to render
   * @returns serialized arguments ready for worker transmission
   */
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

  /**
   * Deserializes the render results from the worker in the client.
   * Creates a React element from the server-side rendered content, or returns
   * an error message if SVG export is not supported.
   *
   * @param results - the results of the render
   * @param args - the arguments passed to render
   * @returns deserialized results with React element or error message
   */
  deserializeResultsInClient(
    res: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    // Handle unsupported SVG export
    if (!this.supportsSVG) {
      return {
        ...res,
        html: SVG_NOT_SUPPORTED_MESSAGE,
      }
    }

    // Create React element from server-side rendered content
    return {
      ...res,
      reactElement: (
        <ServerSideRenderedContent
          {...args}
          {...res}
          RenderingComponent={this.ReactComponent}
        />
      ),
    }
  }

  /**
   * Deserializes the arguments in the worker process, creating proper instances
   * from the serialized data. Converts config snapshot to model instance and
   * recreates filter chain if present.
   *
   * @param args - the serialized arguments to deserialize
   * @returns deserialized arguments with proper instances
   */
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

  /**
   * Serializes the render results in the worker for transmission to the client.
   * Removes the React element (which can't be serialized) and prepares the
   * results for transfer.
   *
   * @param results - object containing the results of calling the `render` method
   * @param _args - deserialized render args (unused but kept for interface consistency)
   * @returns serialized results ready for transmission
   */
  serializeResultsInWorker(
    results: RenderResults,
    _args: RenderArgsDeserialized,
  ): ResultsSerialized {
    // Destructure to omit reactElement from the results
    const { reactElement, ...serializedResults } = results
    return {
      ...serializedResults,
      html: '',
    }
  }

  /**
   * Renders content on the client by making an RPC call to the worker.
   * If the result is an SVG export, it serializes the SVG content.
   *
   * @param rpcManager - RPC manager for worker communication
   * @param args - render arguments
   * @returns serialized render results
   */
  async renderInClient(
    rpcManager: RpcManager,
    args: RenderArgs,
  ): Promise<ResultsSerialized> {
    const results = (await rpcManager.call(
      args.sessionId,
      RPC_METHOD_RENDER,
      args,
    )) as ResultsSerialized

    // Handle SVG export by serializing canvas data
    if (isSvgExport(results)) {
      return {
        ...results,
        html: await getSerializedSvg(results),
      }
    }

    return results
  }

  /**
   * Renders content on the worker. This is where the actual rendering happens
   * in server-side rendering. Updates status during rendering and serialization.
   *
   * @param args - serialized render arguments
   * @returns serialized render results for transmission to client
   */
  async renderInWorker(args: RenderArgsSerialized): Promise<ResultsSerialized> {
    const { stopToken, statusCallback = () => {} } = args
    const deserializedArgs = this.deserializeArgsInWorker(args)

    // Perform the actual rendering
    const results = await updateStatus(STATUS_RENDERING, statusCallback, () =>
      this.render(deserializedArgs),
    )

    // Check if rendering was cancelled
    checkStopToken(stopToken)

    // Serialize results for transmission to main thread
    return updateStatus(STATUS_SERIALIZING, statusCallback, () =>
      this.serializeResultsInWorker(results, deserializedArgs),
    )
  }

  /**
   * Frees resources associated with a render on the worker.
   * Called from the client to clean up worker-side resources.
   *
   * @param rpcManager - RPC manager for worker communication
   * @param args - render arguments identifying resources to free
   */
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
