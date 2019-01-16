import { renderToString } from 'react-dom/server'
import { tap } from 'rxjs/operators'

import { renderRegionWithWorker } from '../render'

import RendererType from '../pluggableElementTypes/RendererType'

import SimpleFeature from '../util/simpleFeature'

class LayoutSession {
  update(props) {
    Object.assign(this, props)
  }
}

export default class BoxRenderer extends RendererType {
  constructor(stuff) {
    super({ ...stuff, sessions: {} })
  }

  getWorkerSession(props) {
    const { sessionId } = props
    if (!this.sessions[sessionId])
      this.sessions[sessionId] = this.createSession()
    const session = this.sessions[sessionId]
    session.update(props)
    return session
  }

  createSession() {
    return new LayoutSession()
  }

  freeResources({ sessionId, region }) {
    if (!region && this.sessions[sessionId]) {
      delete this.sessions[sessionId]
      return 1
    }
    // TODO: implement freeing for regions
    return 0
  }

  /**
   * filter/convert the render arguments to prepare
   * them to be serialized and sent to the worker.
   *
   * the base class replaces the `renderProps.trackModel` param
   * (which on the client is a MST model) with a stub
   * that only contains the `selectedFeature`, since
   * this is the only part of the track model that most
   * renderers read.
   *
   * @param {object} args the arguments passed to render, not modified
   * @returns {object} the converted arguments
   */
  serializeArgsForWorker(args) {
    if (args.renderProps.trackModel) {
      const result = Object.assign({}, args)
      result.renderProps = Object.assign({}, result.renderProps)
      result.renderProps.trackModel = {
        selectedFeatureId: args.renderProps.trackModel.selectedFeatureId,
      }
      return result
    }
    return args
  }

  /**
   * directly modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param {object} args the converted arguments to modify
   */
  deserializeArgsInWorker() {}

  // render method called on the client. should call the worker render
  async renderInClient(app, args) {
    const result = await renderRegionWithWorker(
      app,
      this.serializeArgsForWorker(args),
    )

    // deserialize some of the results that came back from the worker
    const featuresMap = new Map()
    result.features.forEach(j => {
      console.log('hello2', j)
      featuresMap.set(String(j.id), SimpleFeature.fromJSON(j))
    })
    result.features = featuresMap
    result.config = this.configSchema.create(args.renderProps.config || {})

    return result
  }

  async render() {
    throw new Error('render not implemented')
  }

  // render method called on the worker
  async renderInWorker(args) {
    this.deserializeArgsInWorker(args)
    const { dataAdapter, region } = args
    const features = new Map()
    await dataAdapter
      .getFeaturesInRegion(region)
      .pipe(tap(feature => features.set(feature.seq, feature)))
      .toPromise()

    const config = this.configSchema.create(args.config || {})
    const session = this.getWorkerSession(args)
    const renderProps = { ...args, features, config }

    const result = await this.render(renderProps)
    result.html = renderToString(result.element)
    delete result.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    const featureJSON = []
    for (const feature of features.values()) {
      featureJSON.push(feature)
    }
    return {
      ...result,
      features: featureJSON,
    }
  }
}
