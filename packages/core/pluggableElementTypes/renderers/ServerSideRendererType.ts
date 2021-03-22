import { ThemeOptions } from '@material-ui/core'
import { ThemeProvider } from '@material-ui/core/styles'
import { renderToString } from 'react-dom/server'
import React from 'react'
import {
  SnapshotOrInstance,
  SnapshotIn,
  getSnapshot,
  isStateTreeNode,
} from 'mobx-state-tree'
import { checkAbortSignal } from '../../util'
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
   * hydrating of the React HTML string.
   *
   * @param results - the results of the render
   * @param args - the arguments passed to render
   */
  deserializeResultsInClient(
    results: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    const reactElement = React.createElement(ServerSideRenderedContent, {
      ...args,
      ...results,
      RenderingComponent: this.ReactComponent,
    })
    delete results.html
    return { ...results, reactElement }
  }

  /**
   * modifies the passed arguments object to inflate arguments as necessary.
   * called in the worker process.
   *
   * @param args - the converted arguments to modify
   */
  deserializeArgsInWorker(args: RenderArgsSerialized): RenderArgsDeserialized {
    const deserialized = ({ ...args } as unknown) as RenderArgsDeserialized
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
      React.createElement(
        ThemeProvider,
        // @ts-ignore
        { theme: createJBrowseTheme(args.theme) },
        results.reactElement,
      ),
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
    return rpcManager.call(args.sessionId, 'CoreRender', args) as Promise<
      ResultsSerialized
    >
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
    statusCallback('Rendering plot')
    const results = await this.render(deserializedArgs)
    checkAbortSignal(signal)

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    statusCallback('Serializing results')
    const serialized = this.serializeResultsInWorker(results, deserializedArgs)
    statusCallback('')
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
