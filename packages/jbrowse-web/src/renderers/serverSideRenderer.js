import { renderToString } from 'react-dom/server'
import { tap } from 'rxjs/operators'

import { renderRegionWithWorker } from '../render'

import RendererType from '../pluggableElementTypes/RendererType'

import SimpleFeature from '../util/simpleFeature'
import { iterMap } from '../util'

export default class ServerSideRenderer extends RendererType {
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
  serializeArgsInClient(args) {
    if (args.renderProps.trackModel) {
      args.renderProps = {
        ...args.renderProps,
        trackModel: {
          selectedFeatureId: args.renderProps.trackModel.selectedFeatureId,
        },
      }
    }
    return args
  }

  deserializeResultsInClient(result /* , args */) {
    // deserialize some of the results that came back from the worker
    const featuresMap = new Map()
    result.features.forEach(j => {
      featuresMap.set(String(j.id), SimpleFeature.fromJSON(j))
    })
    result.features = featuresMap
    return result
  }

  /**
   * directly modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param {object} args the converted arguments to modify
   */
  deserializeArgsInWorker(args) {
    if (this.configSchema) {
      const config = this.configSchema.create(args.config || {})
      args.config = config
    }
  }

  /**
   *
   * @param {object} result object containing the results of calling the `render` method
   * @param {Map} features Map of feature.id() -> feature
   */
  serializeResultsInWorker(result, features) {
    result.features = iterMap(features.values(), f =>
      f.toJSON ? f.toJSON() : f,
    )
  }

  // render method called on the client. should call the worker render
  async renderInClient(app, args) {
    const result = await renderRegionWithWorker(
      app,
      this.serializeArgsInClient(args),
    )

    this.deserializeResultsInClient(result, args)
    return result
  }

  // render method called on the worker
  async renderInWorker(args) {
    this.deserializeArgsInWorker(args)
    const { dataAdapter, region } = args
    const features = new Map()
    const featureObservable = await dataAdapter.getFeaturesInRegion(region)
    await featureObservable
      .pipe(tap(feature => features.set(feature.id(), feature)))
      .toPromise()

    const renderProps = { ...args, features }

    const results = await this.render(renderProps)
    results.html = renderToString(results.element)
    delete results.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(results, features, args)
    return results
  }
}
