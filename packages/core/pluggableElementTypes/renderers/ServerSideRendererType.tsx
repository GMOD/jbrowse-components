import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'

import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'
import {
  type RasterizedImageData,
  getSerializedSvg,
  updateStatus,
} from '../../util'
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

/**
 * Discriminated Union for Serialized Render Results
 *
 * These types use a discriminated union pattern with a 'type' field to distinguish
 * between different rendering modes. This provides:
 *
 * 1. Type Safety: TypeScript can narrow types based on the 'type' field
 * 2. Exhaustiveness Checking: Switch statements can verify all cases are handled
 * 3. Clear Intent: The type field makes it explicit what kind of result we have
 *
 * Flow:
 * - Worker: renderToAbstractCanvas sets 'svg-vector' or 'svg-raster' for SVG exports
 * - Worker: serializeResultsInWorker preserves the type or defaults to 'normal'
 * - Client: renderInClient converts SVG data to HTML based on type
 * - Client: deserializeResultsInClient uses type to decide whether to create React element
 */

// Base interface for all serialized results - exported so subclasses can extend it
export interface ResultsSerializedBase
  extends Omit<RenderResults, 'reactElement'> {
  type?: string
  html: string
}

// Normal rendering (not SVG export)
export interface ResultsSerializedNormal extends ResultsSerializedBase {
  type: 'normal'
}

// Vector SVG export (canvas commands recorded and replayed to generate SVG)
export interface ResultsSerializedSvgVector extends ResultsSerializedBase {
  type: 'svg-vector'
  canvasRecordedData: unknown
  width: number
  height: number
}

// Rasterized SVG export (canvas rendered to PNG, embedded as <image> in SVG)
export interface ResultsSerializedSvgRaster extends ResultsSerializedBase {
  type: 'svg-raster'
  rasterizedImageData: RasterizedImageData
  width: number
  height: number
}

// Discriminated union of all result types
// Use the 'type' field to determine which variant you have
export type ResultsSerialized =
  | ResultsSerializedNormal
  | ResultsSerializedSvgVector
  | ResultsSerializedSvgRaster

export type ResultsDeserialized = RenderResults

/**
 * Type guard for vector SVG export results
 */
function isSvgVectorExport(
  e: ResultsSerializedBase,
): e is ResultsSerializedSvgVector {
  return e.type === 'svg-vector'
}

/**
 * Type guard for rasterized SVG export results
 */
function isSvgRasterExport(
  e: ResultsSerializedBase,
): e is ResultsSerializedSvgRaster {
  return e.type === 'svg-raster'
}

/**
 * Type guard for any SVG export (vector or raster)
 */
function isSvgExport(
  e: ResultsSerializedBase,
): e is ResultsSerializedSvgVector | ResultsSerializedSvgRaster {
  return e.type === 'svg-vector' || e.type === 'svg-raster'
}

/**
 * Converts SVG export data (vector or raster) to HTML.
 * This centralizes the conversion logic for both export types.
 *
 * Uses type guards to narrow the base type and handle each case appropriately.
 *
 * Note: This is only needed when exporting to static SVG files.
 * For React rendering, the structured data is used directly via ReactRendering.
 */
async function convertSvgExportToHtml(
  results: ResultsSerializedBase,
): Promise<ResultsSerializedBase> {
  // Handle vector SVG export
  if (isSvgVectorExport(results)) {
    return {
      ...results,
      html: await getSerializedSvg(results),
    }
  }

  // Handle rasterized SVG export
  if (isSvgRasterExport(results)) {
    const { width, height, dataURL } = results.rasterizedImageData
    return {
      ...results,
      html: `<image width="${width}" height="${height}" href="${dataURL}" />`,
    }
  }

  // No conversion needed for normal rendering or other types
  return results
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
    res: ResultsSerializedBase,
    args: RenderArgs,
  ): ResultsDeserialized {
    // Handle unsupported SVG export
    if (!this.supportsSVG) {
      return {
        ...res,
        html: SVG_NOT_SUPPORTED_MESSAGE,
      }
    }

    // For SVG export, return results as-is (HTML already generated in renderInClient)
    if (isSvgExport(res)) {
      return res
    }

    // Create React element from server-side rendered content for normal rendering
    return {
      ...res,
      reactElement: <this.ReactComponent {...args} {...res} />,
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
   * If renderToAbstractCanvas was used with SVG export, the results will already
   * have a 'type' field ('svg-vector' or 'svg-raster'). Otherwise, we default to 'normal'.
   *
   * @param results - object containing the results of calling the `render` method
   * @param _args - deserialized render args (unused but kept for interface consistency)
   * @returns serialized results ready for transmission
   */
  serializeResultsInWorker(
    results: RenderResults,
    _args: RenderArgsDeserialized,
  ): ResultsSerializedBase {
    // Destructure to omit reactElement from the results
    const { reactElement, ...serializedResults } = results

    // Check if type was already set by renderToAbstractCanvas
    const resultsWithType = serializedResults as Partial<ResultsSerializedBase>
    const type = resultsWithType.type || 'normal'

    return {
      ...serializedResults,
      type,
      html: resultsWithType.html || '',
    } as ResultsSerializedBase
  }

  /**
   * Renders content on the client by making an RPC call to the worker.
   * If the result is an SVG export, it converts the export data to HTML.
   *
   * @param rpcManager - RPC manager for worker communication
   * @param args - render arguments
   * @returns serialized render results
   */
  async renderInClient(
    rpcManager: RpcManager,
    args: RenderArgs,
  ): Promise<ResultsSerializedBase> {
    const results = (await rpcManager.call(
      args.sessionId,
      RPC_METHOD_RENDER,
      args,
    )) as ResultsSerializedBase

    // Convert SVG export data (if present) to HTML
    return convertSvgExportToHtml(results)
  }

  /**
   * Renders content on the worker. This is where the actual rendering happens
   * in server-side rendering. Updates status during rendering and serialization.
   *
   * @param args - serialized render arguments
   * @returns serialized render results for transmission to client
   */
  async renderInWorker(
    args: RenderArgsSerialized,
  ): Promise<ResultsSerializedBase> {
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
