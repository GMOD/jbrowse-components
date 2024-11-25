import React from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'
import { renderToString } from 'react-dom/server'

// locals
import RendererType from './RendererType'
import ServerSideRenderedContent from './ServerSideRenderedContent'
import { getSerializedSvg, updateStatus } from '../../util'
import SerializableFilterChain from './util/serializableFilterChain'
import { createJBrowseTheme } from '../../ui'

import { checkStopToken } from '../../util/stopToken'
import type { RenderProps, RenderResults } from './RendererType'
import type { AnyConfigurationModel } from '../../configuration'
import type { SerializedFilterChain } from './util/serializableFilterChain'
import type RpcManager from '../../rpc/RpcManager'
import type { ThemeOptions } from '@mui/material'
import type { SnapshotOrInstance, SnapshotIn } from 'mobx-state-tree'

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
   * directly modifies the render arguments to prepare them to be serialized and
   * sent to the worker.
   *
   * @param args - the arguments passed to render
   * @returns the same object
   */
  serializeArgsInClient(args: RenderArgs): RenderArgsSerialized {
    return {
      ...args,
      config: isStateTreeNode(args.config)
        ? getSnapshot(args.config)
        : args.config,
      filters: args.filters?.toJSON().filters,
    }
  }

  /**
   * Deserialize the render results from the worker in the client. Includes
   * hydrating of the React HTML string, and not hydrating the result if SVG is
   * being rendered
   *
   * @param results - the results of the render
   * @param args - the arguments passed to render
   */
  deserializeResultsInClient(
    res: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    // if we are rendering svg, we skip hydration
    if (args.exportSVG) {
      // only return the res if the renderer explicitly has
      // this.supportsSVG support to avoid garbage being rendered in SVG
      // document
      return {
        ...res,
        html: this.supportsSVG
          ? res.html
          : '<text y="12" fill="black">SVG export not supported for this track</text>',
      }
    }

    // get res using ServerSideRenderedContent
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
   * modifies the passed arguments object to inflate arguments as necessary.
   * called in the worker process.
   *
   * @param args - the converted arguments to modify
   */
  deserializeArgsInWorker(args: RenderArgsSerialized): RenderArgsDeserialized {
    const deserialized = { ...args } as unknown as RenderArgsDeserialized
    deserialized.config = this.configSchema.create(args.config || {}, {
      pluginManager: this.pluginManager,
    })
    deserialized.filters = args.filters
      ? new SerializableFilterChain({
          filters: args.filters,
        })
      : undefined

    return deserialized
  }

  /**
   * Serialize results of the render to send them to the client. Includes
   * rendering React to an HTML string.
   *
   * @param results - object containing the results of calling the `render`
   * method
   * @param args - deserialized render args
   */
  serializeResultsInWorker(
    results: RenderResults,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const html = renderToString(
      <ThemeProvider theme={createJBrowseTheme(args.theme)}>
        {results.reactElement}
      </ThemeProvider>,
    )
    results.reactElement = undefined
    return { ...results, html }
  }

  /**
   * Render method called on the client. Serializes args, then calls
   * "CoreRender" with the RPC manager.
   *
   * @param rpcManager - RPC manager
   * @param args - render args
   */
  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    const results = (await rpcManager.call(
      args.sessionId,
      'CoreRender',
      args,
    )) as ResultsSerialized

    if (isSvgExport(results)) {
      results.html = await getSerializedSvg(results)
      results.reactElement = undefined
    }
    return results
  }

  /**
   * Render method called on the worker. `render` is called here in server-side
   * rendering
   *
   * @param args - serialized render args
   */
  async renderInWorker(args: RenderArgsSerialized): Promise<ResultsSerialized> {
    const { stopToken, statusCallback = () => {} } = args
    const deserializedArgs = this.deserializeArgsInWorker(args)

    const results = await updateStatus('Rendering plot', statusCallback, () =>
      this.render(deserializedArgs),
    )
    checkStopToken(stopToken)

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    return updateStatus('Serializing results', statusCallback, () =>
      this.serializeResultsInWorker(results, deserializedArgs),
    )
  }

  async freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    const freed = this.freeResources()
    const freedRpc = (await rpcManager.call(
      args.sessionId,
      'CoreFreeResources',
      serializedArgs,
    )) as number
    return freed + freedRpc
  }
}

export { type RenderResults } from './RendererType'
