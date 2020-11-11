import { ThemeProvider } from '@material-ui/core/styles'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { filter, ignoreElements, tap } from 'rxjs/operators'
import {
  SnapshotOrInstance,
  SnapshotIn,
  getSnapshot,
  isStateTreeNode,
} from 'mobx-state-tree'
import { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter'
import { Region } from '../../util/types'
import { checkAbortSignal, iterMap } from '../../util'
import SimpleFeature, {
  Feature,
  SimpleFeatureSerialized,
} from '../../util/simpleFeature'
import RendererType from './RendererType'
import SerializableFilterChain, {
  SerializedFilterChain,
} from './util/serializableFilterChain'
import { AnyConfigurationModel } from '../../configuration/configurationSchema'
import RpcManager from '../../rpc/RpcManager'
import { createJBrowseTheme } from '../../ui'

interface BaseRenderArgs {
  blockKey: string
  sessionId: string
  signal?: AbortSignal
  dataAdapter: BaseFeatureDataAdapter
  sortObject?: {
    position: number
    by: string
  }
  bpPerPx: number
  renderProps: {
    displayModel: { id: string; selectedFeatureId?: string }
    blockKey: string
  }
  regions: Region[]
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

export interface RenderResults {
  html: string
}
export interface ResultsSerialized extends RenderResults {
  features: SimpleFeatureSerialized[]
}

export interface ResultsDeserialized {
  html: string
  blockKey: string
  features: Map<string, Feature>
}

export default class ServerSideRenderer extends RendererType {
  /**
   * directly modifies the render arguments to prepare
   * them to be serialized and sent to the worker.
   *
   * the base class replaces the `renderProps.displayModel` param
   * (which on the client is a MST model) with a stub
   * that only contains the `selectedFeature`, since
   * this is the only part of the track model that most
   * renderers read.
   *
   * @param args - the arguments passed to render
   * @returns the same object
   */
  serializeArgsInClient(args: RenderArgs): RenderArgsSerialized {
    const { displayModel } = args.renderProps
    if (displayModel) {
      args.renderProps = {
        ...args.renderProps,
        blockKey: args.blockKey,
        displayModel: {
          id: displayModel.id,
          selectedFeatureId: displayModel.selectedFeatureId,
        },
      }
    }
    return {
      ...args,
      config: isStateTreeNode(args.config)
        ? getSnapshot(args.config)
        : args.config,
      regions: JSON.parse(JSON.stringify(args.regions)),
      filters: args.filters ? args.filters.toJSON().filters : [],
    }
  }

  deserializeResultsInClient(
    result: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    // deserialize some of the results that came back from the worker
    const deserialized = ({ ...result } as unknown) as ResultsDeserialized
    const featuresMap = new Map<string, SimpleFeature>()
    result.features.forEach(j => {
      const f = SimpleFeature.fromJSON(j)
      featuresMap.set(String(f.id()), f)
    })
    deserialized.features = featuresMap
    deserialized.blockKey = args.blockKey
    return deserialized
  }

  /**
   * modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param args - the converted arguments to modify
   */
  deserializeArgsInWorker(args: RenderArgsSerialized): RenderArgsDeserialized {
    const deserialized = ({ ...args } as unknown) as RenderArgsDeserialized
    const config = this.configSchema.create(args.config || {})
    deserialized.config = config
    deserialized.filters = new SerializableFilterChain({
      filters: args.filters,
    })

    return deserialized
  }

  /**
   *
   * @param result - object containing the results of calling the `render` method
   * @param features - Map of `feature.id() -> feature`
   * @param args - deserialized render args. unused here, but may be used in
   * deriving class methods
   */
  serializeResultsInWorker(
    result: { html: string },
    features: Map<string, Feature>,
    _args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const serialized = ({ ...result } as unknown) as ResultsSerialized
    serialized.features = iterMap(features.values(), f => f.toJSON())
    return serialized
  }

  /**
   * Render method called on the client. Serializes args, then
   * calls `render` with the RPC manager.
   */
  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)
    const result = await rpcManager.call(
      args.sessionId,
      'CoreRender',
      serializedArgs,
    )
    // const result = await renderRegionWithWorker(session, serializedArgs)

    // @ts-ignore
    const deserialized = this.deserializeResultsInClient(result, args)
    return deserialized
  }

  // will expand if soft clipping or feature glyphs are shown
  getExpandedRegion(region: Region, _renderArgs: RenderArgsDeserialized) {
    return region
  }

  /**
   * use the dataAdapter to fetch the features to be rendered
   *
   * @param renderArgs -
   * @returns Map of features as `{ id => feature, ... }`
   */
  async getFeatures(renderArgs: RenderArgsDeserialized) {
    const { dataAdapter, signal, regions } = renderArgs
    const features = new Map()

    if (!regions || regions.length === 0) {
      return features
    }

    const requestRegions = regions.map((r: Region) => {
      // make sure the requested region's start and end are integers, if
      // there is a region specification.
      const requestRegion = { ...r }
      if (requestRegion.start) {
        requestRegion.start = Math.floor(requestRegion.start)
      }
      if (requestRegion.end) {
        requestRegion.end = Math.ceil(requestRegion.end)
      }
      return requestRegion
    })

    const region = requestRegions[0]

    const featureObservable =
      requestRegions.length === 1
        ? dataAdapter.getFeatures(
            this.getExpandedRegion(region, renderArgs),
            // @ts-ignore
            renderArgs,
          )
        : // @ts-ignore
          dataAdapter.getFeaturesInMultipleRegions(requestRegions, renderArgs)

    await featureObservable
      .pipe(
        tap(() => checkAbortSignal(signal)),
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        tap(feature => {
          const id = feature.id()
          if (!id) throw new Error(`invalid feature id "${id}"`)
          features.set(id, feature)
        }),
        ignoreElements(),
      )
      .toPromise()

    return features
  }

  /**
   * @param renderArgs -
   * @param feature -
   * @returns true if this feature passes all configured filters
   */
  featurePassesFilters(renderArgs: RenderArgsDeserialized, feature: Feature) {
    if (!renderArgs.filters) return true
    return renderArgs.filters.passes(feature, renderArgs)
  }

  // render method called on the worker
  async renderInWorker(args: RenderArgsSerialized): Promise<ResultsSerialized> {
    const { signal, statusCallback = () => {} } = args
    checkAbortSignal(signal)
    const deserializedArgs = this.deserializeArgsInWorker(args)

    const features = await this.getFeatures(deserializedArgs)
    checkAbortSignal(signal)
    statusCallback('Rendering plot')
    const results = await this.render({ ...deserializedArgs, features })
    checkAbortSignal(signal)
    const html = renderToString(
      React.createElement(
        ThemeProvider,
        // @ts-ignore
        { theme: createJBrowseTheme(args.theme) },
        results.element,
      ),
    )
    delete results.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    statusCallback('Serializing results')
    const serialized = this.serializeResultsInWorker(
      { ...results, html },
      features,
      deserializedArgs,
    )
    statusCallback('')
    return serialized
  }

  freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    return rpcManager.call(args.sessionId, 'CoreFreeResources', serializedArgs)
  }

  freeResources(/* args: {} */) {
    return 0
  }
}
