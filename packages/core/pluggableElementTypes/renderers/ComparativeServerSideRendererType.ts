/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToString } from 'react-dom/server'
import { filter, distinct, toArray, tap } from 'rxjs/operators'
import { types, getSnapshot, cast } from 'mobx-state-tree'
import { trace } from 'mobx'
import BaseAdapter from '../../BaseAdapter'
import { IRegion, Region } from '../../mst-types'
import { checkAbortSignal } from '../../util'
import { Feature } from '../../util/simpleFeature'
import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'
import calculateDynamicBlocks from '../../util/calculateDynamicBlocks'
import calculateStaticBlocks from '../../util/calculateStaticBlocks'

interface RenderArgs {
  blockKey: string
  sessionId: string
  signal?: AbortSignal
  filters?: any
  dataAdapter: BaseAdapter
  bpPerPx: number
  regions?: any
  config: Record<string, any>
  renderProps: { trackModel: any }
  views: any[]
}
const model = types
  .model('1DView', {
    displayedRegions: types.array(Region),
    bpPerPx: 0,
    offsetPx: 0,
    horizontallyFlipped: false,
    width: 0,
  })
  .volatile(() => ({
    features: undefined as undefined | Feature[],
  }))
  .actions(self => ({
    setDisplayedRegions(regions: IRegion[]) {
      self.displayedRegions = cast(regions)
    },
    setBpPerPx(val: number) {
      self.bpPerPx = val
    },
  }))
  .views(self => ({
    get displayedRegionsTotalPx() {
      return this.totalBp / self.bpPerPx
    },

    get maxOffset() {
      // objectively determined to keep the linear genome on the main screen
      const leftPadding = 10
      return this.displayedRegionsTotalPx - leftPadding
    },

    get minOffset() {
      // objectively determined to keep the linear genome on the main screen
      const rightPadding = 30
      return -self.width + rightPadding
    },
    get dynamicBlocks() {
      return calculateDynamicBlocks(self)
    },
    get staticBlocks() {
      return calculateStaticBlocks(cast(self))
    },
    get totalBp() {
      return self.displayedRegions
        .map(a => a.end - a.start)
        .reduce((a, b) => a + b, 0)
    },
    get currBp() {
      return this.dynamicBlocks
        .map(a => a.end - a.start)
        .reduce((a, b) => a + b, 0)
    },
    bpToPx(refName: string, coord: number) {
      let offsetBp = 0

      const index = self.displayedRegions.findIndex(r => {
        if (refName === r.refName && coord >= r.start && coord <= r.end) {
          offsetBp += self.horizontallyFlipped ? r.end - coord : coord - r.start
          return true
        }
        offsetBp += r.end - r.start
        return false
      })
      const foundRegion = self.displayedRegions[index]
      if (foundRegion) {
        return Math.round(offsetBp / self.bpPerPx)
      }
      return undefined
    },

    /**
     *
     * @param {number} px px in the view area, return value is the displayed regions
     * @returns {BpOffset} of the displayed region that it lands in
     */
    pxToBp(px: number) {
      const bp = (self.offsetPx + px) * self.bpPerPx
      let bpSoFar = 0
      let r = self.displayedRegions[0]
      if (bp < 0) {
        return {
          ...r,
          offset: bp,
          index: 0,
        }
      }
      for (let index = 0; index < self.displayedRegions.length; index += 1) {
        r = self.displayedRegions[index]
        if (r.end - r.start + bpSoFar > bp && bpSoFar <= bp) {
          return { ...r, offset: bp - bpSoFar, index }
        }
        bpSoFar += r.end - r.start
      }

      return {
        ...r,
        offset: bp - bpSoFar,
        index: self.displayedRegions.length - 1,
      }
    },
  }))
  .actions(self => ({
    setFeatures(features: Feature[]) {
      self.features = features
    },
  }))
export default class ComparativeServerSideRenderer extends RendererType {
  /**
   * directly modifies the render arguments to prepare
   * them to be serialized and sent to the worker.
   *
   * the base class replaces the `renderProps.trackModel` param
   * (which on the client is a MST model) with a stub
   * that only contains the `selectedFeature`, since
   * this is the only part of the track model that most
   * renderers read.
   *
   * @param {object} args the arguments passed to render
   * @returns {object} the same object
   */
  serializeArgsInClient(args: RenderArgs) {
    const { trackModel } = args.renderProps
    args.renderProps = {
      ...args.renderProps,
      // @ts-ignore
      blockKey: args.blockKey,
      // @ts-ignore
      views: args.views.map(view => {
        return getSnapshot(view)
      }),
      trackModel: {},
    }
    delete args.views

    return args
  }

  // deserialize some of the results that came back from the worker
  deserializeResultsInClient(result: { features: any }, args: RenderArgs) {
    // @ts-ignore
    result.blockKey = args.blockKey
    return result
  }

  /**
   * directly modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param {object} args the converted arguments to modify
   */
  deserializeArgsInWorker(args: Record<string, any>) {
    // @ts-ignore
    if (this.configSchema) {
      // @ts-ignore
      const config = this.configSchema.create(args.config || {})
      args.config = config
    }
  }

  /**
   *
   * @param {object} result object containing the results of calling the `render` method
   * @param {Map} features Map of feature.id() -> feature
   */
  serializeResultsInWorker(result: Record<string, any>, args: RenderArgs) {
    // does nothing currently
  }

  /**
   * Render method called on the client. Serializes args, then
   * calls `render` with the RPC manager.
   */
  async renderInClient(rpcManager: any, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    const stateGroupName = args.sessionId
    const result = await rpcManager.call(
      stateGroupName,
      'comparativeRender',
      serializedArgs,
    )

    this.deserializeResultsInClient(result, args)
    return result
  }

  /**
   * @param {object} renderArgs
   * @param {FeatureI} feature
   * @returns {boolean} true if this feature passes all configured filters
   */
  featurePassesFilters(renderArgs: RenderArgs, feature: Feature) {
    const filterChain = new SerializableFilterChain({
      filters: renderArgs.filters,
    })
    return filterChain.passes(feature, renderArgs)
  }

  /**
   * use the dataAdapter to fetch the features to be rendered
   *
   * @param {object} renderArgs
   * @returns {Map} of features as { id => feature, ... }
   */
  async getFeatures(renderArgs: RenderArgs) {
    const { dataAdapter, signal, bpPerPx } = renderArgs

    let regions = [] as IRegion[]

    // @ts-ignore this is instantiated by the getFeatures call
    regions = renderArgs.regions

    if (!regions || regions.length === 0) {
      console.warn('no regions supplied to comparative renderer')
      return []
    }

    const requestRegions = regions.map((r: IRegion) => {
      // make sure the requested region's start and end are integers, if
      // there is a region specification.
      const requestRegion = { ...r }
      if (requestRegion.start) {
        requestRegion.start = Math.floor(requestRegion.start)
      }
      if (requestRegion.end) {
        requestRegion.end = Math.floor(requestRegion.end)
      }
      return requestRegion
    })

    // note that getFeaturesInMultipleRegions does not do glyph expansion
    const featureObservable = dataAdapter.getFeaturesInMultipleRegions(
      requestRegions,
      {
        signal,
        bpPerPx,
      },
    )

    return featureObservable
      .pipe(
        tap(() => checkAbortSignal(signal)),
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        distinct(feature => feature.id()),
        toArray(),
      )
      .toPromise()
  }

  // render method called on the worker
  async renderInWorker(args: RenderArgs) {
    checkAbortSignal(args.signal)
    this.deserializeArgsInWorker(args)
    const width = [args.width, args.height]

    const realizedViews = args.views.map((view, idx) =>
      model.create({ ...view, width: width[idx] }),
    )

    await Promise.all(
      realizedViews.map(async view => {
        view.setFeatures(
          await this.getFeatures({
            ...args,
            regions: view.dynamicBlocks.contentBlocks,
          }),
        )
      }),
    )

    checkAbortSignal(args.signal)

    const results = await this.render({ ...args, views: realizedViews })
    checkAbortSignal(args.signal)
    // @ts-ignore
    results.html = renderToString(results.element)
    delete results.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(results, args)
    return results
  }

  freeResourcesInClient(rpcManager: any, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    const stateGroupName = args.sessionId
    return rpcManager.call(stateGroupName, 'freeResources', serializedArgs)
  }

  freeResourcesInWorker(args: RenderArgs) {
    /* stub method */
  }
}
