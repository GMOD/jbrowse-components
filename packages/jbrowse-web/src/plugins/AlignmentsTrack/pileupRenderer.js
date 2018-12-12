import React from 'react'
import { renderToString } from 'react-dom/server'
import { toArray } from 'rxjs/operators'

import { renderRegionWithWorker } from '../../render'

import { RendererType } from '../../Plugin'

import {
  createCanvas,
  createImageBitmap,
} from '../../util/offscreenCanvasPonyfill'

import PileupRendering from './components/PileupRendering'
import GranularRectLayout from '../../util/GranularRectLayout'

import PrecomputedLayout from '../../util/PrecomputedLayout'

import SimpleFeature from '../../util/simpleFeature'
import { ConfigurationSchema, readConfObject } from '../../configuration'
import { bpToPx } from '../../util'

class PileupSession {
  update(props) {
    Object.assign(this, props)
  }

  get layout() {
    const pitchX = this.bpPerPx
    if (!this.cachedLayout || this.cachedLayout.pitchX !== pitchX) {
      this.cachedLayout = new GranularRectLayout({ pitchX, pitchY: 3 })
    }
    return this.cachedLayout
  }
}

const sessions = {}
class PileupRenderer extends RendererType {
  getWorkerSession(props) {
    const { sessionId } = props
    if (!sessions[sessionId]) sessions[sessionId] = this.createSession()
    const session = sessions[sessionId]
    session.update(props)
    return session
  }

  createSession() {
    return new PileupSession()
  }

  freeResources({ sessionId, region }) {
    if (!region && sessions[sessionId]) {
      delete sessions[sessionId]
      return 1
    }
    return 0
  }

  layoutFeature(
    feature,
    layout,
    config,
    bpPerPx,
    region,
    horizontallyFlipped = false,
  ) {
    if (horizontallyFlipped)
      throw new Error('horizontal flipping not yet implemented')
    const leftBase = region.start
    const startPx = bpToPx(
      feature.get('start'),
      region,
      bpPerPx,
      horizontallyFlipped,
    )
    const endPx = bpToPx(
      feature.get('end'),
      region,
      bpPerPx,
      horizontallyFlipped,
    )
    const heightPx = readConfObject(config, 'alignmentHeight', [feature])
    // if (Number.isNaN(startPx)) debugger
    // if (Number.isNaN(endPx)) debugger
    const topPx = layout.addRect(
      feature.id(),
      feature.get('start'),
      feature.get('end'),
      heightPx, // height
      feature,
    )

    return {
      feature,
      startPx,
      endPx,
      topPx,
      heightPx,
    }
  }

  async makeImageData({
    features,
    layout,
    config,
    region,
    bpPerPx,
    horizontallyFlipped,
  }) {
    if (!layout) throw new Error(`layout required`)
    if (!layout.addRect) throw new Error('invalid layout')

    const layoutRecords = features.map(feature =>
      this.layoutFeature(
        feature,
        layout,
        config,
        bpPerPx,
        region,
        horizontallyFlipped,
      ),
    )

    const width = (region.end - region.start) / bpPerPx
    const height = layout.getTotalHeight()
    if (!(width > 0) || !(height > 0)) return { height: 0, width: 0 }

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    layoutRecords.forEach(({ feature, startPx, endPx, topPx, heightPx }) => {
      ctx.fillStyle = readConfObject(config, 'alignmentColor', [feature])
      ctx.fillRect(startPx, topPx, endPx - startPx, heightPx)
    })

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width }
  }

  // render method called on the client. should call the worker render
  async renderInClient(app, args) {
    const result = await renderRegionWithWorker(app, args)

    // deserialize some of the results that came back from the worker
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

    // inflate our configuration
    const config = this.configSchema.create(args.config || {})

    const session = this.getWorkerSession(args)
    const renderProps = { ...args, features, layout: session.layout, config }
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    const html = renderToString(element)

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    return {
      features: features.map(f => f.toJSON()),
      html,
      layout: session.layout.toJSON(),
      height,
      width,
      imageData,
    }
  }
}

export const ConfigSchema = ConfigurationSchema('PileupRenderer', {
  alignmentColor: {
    type: 'color',
    description: 'the color of each feature in a pileup alignment',
    defaultValue: `function(feature) { var s = feature.get('strand'); return s === '-' || s === -1 ? 'blue': 'red' }`,
  },
  alignmentHeight: {
    type: 'integer',
    description: 'the height of each feature in a pileup alignment',
    defaultValue: 5,
  },
})

export default pluginManager =>
  new PileupRenderer({
    name: 'PileupRenderer',
    ReactComponent: PileupRendering,
    configSchema: ConfigSchema,
  })
