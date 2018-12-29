import { renderToString } from 'react-dom/server'
import { tap } from 'rxjs/operators'

import { renderRegionWithWorker } from '../render'

import RendererType from '../pluggableElementTypes/RendererType'

import GranularRectLayout from '../util/layouts/GranularRectLayout'

import PrecomputedLayout from '../util/layouts/PrecomputedLayout'

import SimpleFeature from '../util/simpleFeature'
import MultiLayout from '../util/layouts/MultiLayout'
import { iterMap } from '../util'

class LayoutSession {
  update(props) {
    Object.assign(this, props)
  }

  get layout() {
    const pitchX = this.bpPerPx
    if (
      !this.cachedLayout ||
      this.cachedLayout.subLayoutConstructorArgs.pitchX !== pitchX
    ) {
      this.cachedLayout = new MultiLayout(GranularRectLayout, {
        pitchX,
        pitchY: 3,
      })
    }
    return this.cachedLayout
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

  processArgsForWorker(args) {
    const result = { ...args }
    if (result.trackModel)
      result.trackModel = {
        selectedFeatureId: result.trackModel.selectedFeatureId,
      }
    return result
  }

  // render method called on the client. should call the worker render
  async renderInClient(app, args) {
    const result = await renderRegionWithWorker(
      app,
      this.processArgsForWorker(args),
    )

    // deserialize some of the results that came back from the worker
    result.layout = new PrecomputedLayout(result.layout)
    const featuresMap = new Map()
    result.features.forEach(j =>
      featuresMap.set(String(j.id), SimpleFeature.fromJSON(j)),
    )
    result.features = featuresMap
    result.config = this.configSchema.create(args.renderProps.config || {})

    return result
  }

  async render() {
    throw new Error('render not implemented')
  }

  // render method called on the worker
  async renderInWorker(args) {
    const { dataAdapter, region } = args
    const features = new Map()
    await dataAdapter
      .getFeaturesInRegion(region)
      .pipe(tap(feature => features.set(feature.id(), feature)))
      .toPromise()

    const config = this.configSchema.create(args.config || {})
    const session = this.getWorkerSession(args)
    const subLayout = session.layout.getSublayout(
      `${region.assembly}:${region.refName}`,
    )
    const renderProps = { ...args, features, layout: subLayout, config }

    const result = await this.render(renderProps)
    result.html = renderToString(result.element)
    delete result.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    const featureJSON = []
    for (const feature of features.values()) featureJSON.push(feature.toJSON())
    return {
      ...result,
      features: featureJSON,
      layout: subLayout.toJSON(),
    }
  }
}
