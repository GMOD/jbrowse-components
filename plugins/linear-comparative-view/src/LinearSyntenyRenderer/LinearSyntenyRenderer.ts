import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import Base1DView, {
  Base1DViewModel,
} from '@gmod/jbrowse-core/util/Base1DViewModel'

export default class LinearSyntenyRenderer extends ComparativeServerSideRendererType {
  async render(renderProps: {
    height: number
    width: number
    view: { views: Base1DViewModel[] }
  }) {
    const {
      width,
      view: { views },
    } = renderProps
    const realizedViews = views.map(snap => {
      const view = Base1DView.create(snap)
      view.setVolatileWidth(width)
      return view
    })
    const features = await Promise.all(
      realizedViews.map(view =>
        this.getFeatures({
          ...renderProps,
          regions: view.staticBlocks.contentBlocks,
        }),
      ),
    )

    const serializedFeatures = JSON.parse(JSON.stringify(features))
    for (let i = 0; i < serializedFeatures.length; i++) {
      for (let j = 0; j < serializedFeatures[i].length; j++) {
        // eslint-disable-next-line no-underscore-dangle
        serializedFeatures[i][j]._level = i
      }
    }

    return {
      features: serializedFeatures,
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
