import React from 'react'
import { ThemeOptions } from '@material-ui/core'
import { ThemeProvider } from '@material-ui/core/styles'
import { renderToString } from 'react-dom/server'

import {
  SnapshotOrInstance,
  SnapshotIn,
  getSnapshot,
  isStateTreeNode,
} from 'mobx-state-tree'
import { checkAbortSignal, updateStatus } from '../../util'
import RendererType, { RenderProps, RenderResults } from './RendererType'
import SerializableFilterChain, {
  SerializedFilterChain,
} from './util/serializableFilterChain'
import { AnyConfigurationModel } from '../../configuration/configurationSchema'
import RpcManager from '../../rpc/RpcManager'
import { createJBrowseTheme } from '../../ui'
import ServerSideRenderedContent from './ServerSideRenderedContent'

interface BaseRenderArgs extends RenderProps {
  sessionId: string
  // Note that signal serialization happens after serializeArgsInClient and
  // deserialization happens before deserializeArgsInWorker
  signal?: AbortSignal
  theme: ThemeOptions
  exportSVG: { rasterizeLayers?: boolean }
}

export interface RenderArgs extends BaseRenderArgs {
  config: SnapshotOrInstance<AnyConfigurationModel>
  filters: SerializableFilterChain
}

export interface RenderArgsSerialized extends BaseRenderArgs {
  statusCallback?: Function
  config: SnapshotIn<AnyConfigurationModel>
  filters: SerializedFilterChain
}
export interface RenderArgsDeserialized extends BaseRenderArgs {
  config: AnyConfigurationModel
  filters: SerializableFilterChain
}

export type { RenderResults }

export interface ResultsSerialized extends Omit<RenderResults, 'reactElement'> {
  html: string
}

export type ResultsDeserialized = RenderResults

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
      filters: args.filters && args.filters.toJSON().filters,
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
    results: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    const { html, ...rest } = results

    // if we are rendering svg, we skip hydration
    if (args.exportSVG) {
      // only return the results if the renderer explicitly has
      // this.supportsSVG support to avoid garbage being rendered in SVG
      // document
      return {
        ...results,
        html: this.supportsSVG
          ? results.html
          : '<text y="12" fill="black">SVG export not supported for this track</text>',
      }
    }

    // hydrate results using ServerSideRenderedContent
    return {
      ...rest,
      reactElement: (
        <ServerSideRenderedContent
          {...args}
          {...results}
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
    const config = this.configSchema.create(args.config || {}, {
      pluginManager: this.pluginManager,
    })
    deserialized.config = config
    deserialized.filters = new SerializableFilterChain({
      filters: args.filters,
    })

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
    delete results.reactElement
    return { ...results, html }
  }

  /**
   * Render method called on the client. Serializes args, then calls
   * "CoreRender" with the RPC manager.
   *
   * @param rpcManager - RPC mananger
   * @param args - render args
   */
  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    return rpcManager.call(
      args.sessionId,
      'CoreRender',
      args,
    ) as Promise<ResultsSerialized>
  }

  /**
   * Render method called on the worker. `render` is called here in server-side
   * rendering
   *
   * @param args - serialized render args
   */
  async renderInWorker(args: RenderArgsSerialized): Promise<ResultsSerialized> {
    const { signal, statusCallback = () => {} } = args
    checkAbortSignal(signal)
    const deserializedArgs = this.deserializeArgsInWorker(args)

    checkAbortSignal(signal)
    const results = await updateStatus('Rendering plot', statusCallback, () =>
      this.render(deserializedArgs),
    )
    checkAbortSignal(signal)

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    const serialized = await updateStatus(
      'Serializing results',
      statusCallback,
      () => this.serializeResultsInWorker(results, deserializedArgs),
    )
    return serialized
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
