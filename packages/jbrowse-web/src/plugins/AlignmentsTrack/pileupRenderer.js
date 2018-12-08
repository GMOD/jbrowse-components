import React from 'react'
import { RendererType } from '../../Plugin'
import PileupRendering from './components/PileupRendering'
import GranularRectLayout from '../../util/GranularRectLayout'

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

  render(props) {
    const session = this.getWorkerSession(props)
    const renderProps = { ...props, layout: session.layout }
    return {
      element: React.createElement(this.ReactComponent, renderProps, null),
      layout: session.layout,
    }
  }
}

export default pluginManager =>
  new PileupRenderer({
    name: 'PileupRenderer',
    ReactComponent: PileupRendering,
  })
