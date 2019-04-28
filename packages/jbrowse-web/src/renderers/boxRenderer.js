import GranularRectLayout from '@gmod/jbrowse-core/util/layouts/GranularRectLayout'

import PrecomputedLayout from '@gmod/jbrowse-core/util/layouts/PrecomputedLayout'

import MultiLayout from '@gmod/jbrowse-core/util/layouts/MultiLayout'
import ServerSideRenderer from './serverSideRenderer'

export class LayoutSession {
  update(props) {
    Object.assign(this, props)
  }

  makeLayout() {
    const pitchX = this.bpPerPx
    return new MultiLayout(GranularRectLayout, {
      pitchX,
      pitchY: 3,
    })
  }

  /**
   * @param {*} layout
   * @returns {boolean} true if the given layout is a valid one to use for this session
   */
  layoutIsValid(layout) {
    return layout && layout.subLayoutConstructorArgs.pitchX === this.bpPerPx
  }

  get layout() {
    if (!this.cachedLayout || !this.layoutIsValid(this.cachedLayout)) {
      this.cachedLayout = this.makeLayout()
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

  deserializeLayoutInClient(json) {
    return new PrecomputedLayout(json)
  }

  deserializeResultsInClient(result, args) {
    super.deserializeResultsInClient(result, args)
    result.layout = this.deserializeLayoutInClient(result.layout)
    return result
  }

  deserializeLayoutInWorker(args) {
    const { region } = args
    const session = this.getWorkerSession(args)
    const subLayout = session.layout.getSublayout(region.refName)
    return subLayout
  }

  deserializeArgsInWorker(args) {
    super.deserializeArgsInWorker(args)
    args.layout = this.deserializeLayoutInWorker(args)
  }

  serializeResultsInWorker(results, features, args) {
    super.serializeResultsInWorker(results, features, args)
    results.layout = args.layout.toJSON()
  }
}
