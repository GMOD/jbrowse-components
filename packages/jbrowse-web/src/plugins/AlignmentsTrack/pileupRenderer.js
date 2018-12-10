import React from 'react'
import { renderToString } from 'react-dom/server'
import { toArray } from 'rxjs/operators'

import { renderRegionWithWorker } from '../../render'

import { RendererType } from '../../Plugin'
import PileupRendering from './components/PileupRendering'
import GranularRectLayout from '../../util/GranularRectLayout'

import PrecomputedLayout from '../../util/PrecomputedLayout'

import SimpleFeature from '../../util/simpleFeature'

class PileupSession {
  update(props) {
    Object.entries(props).forEach(([key, val]) => {
      this[key] = val
    })
  }

  get layout() {
    const pitchX = this.bpPerPx
    if (!this.cachedLayout || this.cachedLayout.pitchX !== pitchX) {
      this.cachedLayout = new GranularRectLayout({ pitchX, pitchY: 10 })
    }
    return this.cachedLayout
  }
}

const sessions = {}
class PileupRenderer extends RendererType {
  getWorkerSession(props) {
    const { sessionId } = props
    if (!sessions[sessionId]) sessions[sessionId] = new PileupSession()
    const session = sessions[sessionId]
    session.update(props)
    return session
  }

  freeResources({ sessionId, region }) {
    if (!region && sessions[sessionId]) {
      delete sessions[sessionId]
      return 1
    }
    return 0
  }

  // render method called on the client. should call the worker render
  async renderInClient(app, args) {
    const result = await renderRegionWithWorker(app, args)

    // deserialize the results that came back from the worker
    result.layout = new PrecomputedLayout(result.layout)
    result.features = result.features.map(j => SimpleFeature.fromJSON(j))

    return result
  }

  // render method called on the worker
  async renderInWorker(args) {
    const { dataAdapter, region } = args
    const features = await dataAdapter
      .getFeaturesInRegion(region)
      .pipe(toArray())
      .toPromise()

    const session = this.getWorkerSession(args)
    const renderProps = { ...args, features, layout: session.layout }
    const element = React.createElement(this.ReactComponent, renderProps, null)
    const html = renderToString(element)

    return {
      features: features.map(f => f.toJSON()),
      html,
      layout: session.layout.toJSON(),
    }
  }
}

export default pluginManager =>
  new PileupRenderer({
    name: 'PileupRenderer',
    ReactComponent: PileupRendering,
  })
