import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { getSnapshot } from 'mobx-state-tree'
import Base1DView, {
  Base1DViewModel,
} from '@gmod/jbrowse-core/util/Base1DViewModel'
import { filter, toArray } from 'rxjs/operators'
import { IRegion } from '@gmod/jbrowse-core/mst-types'

export default class LinearSyntenyRenderer extends ComparativeServerSideRendererType {
  async render(renderProps: {
    height: number
    width: number
    views: Base1DViewModel[]
  }) {
    const { height, width, views: serializedViews } = renderProps
    const dimensions = [width, height]
    console.log(renderProps, 'test')
    const realizedViews = serializedViews.map((view, idx) =>
      Base1DView.create({ ...view, width: dimensions[idx] }),
    )
    await Promise.all(
      realizedViews.map(async view => {
        view.setFeatures(
          await this.getFeatures({
            ...renderProps,
            regions: view.dynamicBlocks.contentBlocks,
          }),
        )
      }),
    )
    const views = realizedViews.map(r => ({
      ...getSnapshot(r),
      features: (r.features || []).map(f => f.toJSON()),
    }))
    return {
      views,
      height,
      width,
    }
  }

  /**
   * use the dataAdapter to fetch the features to be rendered
   *
   * @param {object} renderArgs
   * @returns {Map} of features as { id => feature, ... }
   */
  async getFeatures(renderArgs: any) {
    const { dataAdapter, signal } = renderArgs

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
      },
    )

    return featureObservable
      .pipe(
        // @ts-ignore
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        toArray(),
      )
      .toPromise()
  }

  // render method called on the worker
  async renderInWorker(args: any) {
    this.deserializeArgsInWorker(args)

    const results = await this.render(args)

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(results, args)
    return results
  }
}
