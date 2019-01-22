import GranularRectLayout from '../util/layouts/GranularRectLayout'

import PrecomputedLayout from '../util/layouts/PrecomputedLayout'

import MultiLayout from '../util/layouts/MultiLayout'
import ServerSideRenderer from './serverSideRenderer'

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

export default class BoxRenderer extends ServerSideRenderer {
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

  deserializeResultsInClient(result, args) {
    super.deserializeResultsInClient(result, args)
    result.layout = new PrecomputedLayout(result.layout)
    return result
  }

  deserializeArgsInWorker(args) {
    super.deserializeArgsInWorker(args)
    const { region } = args
    const config = this.configSchema.create(args.config || {})
    const session = this.getWorkerSession(args)
    const subLayout = session.layout.getSublayout(
      `${region.assembly}:${region.refName}`,
    )
    args.layout = subLayout
    args.config = config
  }

  async render() {
    throw new Error('render not implemented')
  }

  serializeResultsInWorker(results, features, args) {
    super.serializeResultsInWorker(results, features, args)
    results.layout = args.layout.toJSON()
  }
}
