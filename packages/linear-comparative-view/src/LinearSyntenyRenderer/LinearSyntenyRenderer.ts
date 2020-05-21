import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { getSnapshot } from 'mobx-state-tree'
import Base1DView, {
  Base1DViewModel,
} from '@gmod/jbrowse-core/util/Base1DViewModel'

export default class LinearSyntenyRenderer extends ComparativeServerSideRendererType {
  async render(renderProps: {
    height: number
    width: number
    views: Base1DViewModel[]
  }) {
    const { height, width, views: serializedViews } = renderProps
    const realizedViews = serializedViews.map(snap => {
      const view = Base1DView.create(snap)
      view.setVolatileWidth(width)
      return view
    })
    await Promise.all(
      realizedViews.map(async view => {
        view.setFeatures(
          await this.getFeatures({
            ...renderProps,
            regions: view.staticBlocks.contentBlocks,
          }),
        )
      }),
    )
    const views = realizedViews.map(r => ({
      ...getSnapshot(r),
      features: (r.features || []).map(f => f.toJSON()),
    }))
    return {
      offsets: views.map(view => view.offsetPx),
      views,
      height,
      width,
    }
  }

  // render method called on the worker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
