import deepEqual from 'deep-equal'
import { readConfObject } from '../../configuration'
import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'
import PrecomputedLayout from '../../util/layouts/PrecomputedLayout'
import ServerSideRendererType from './ServerSideRendererType'

export class LayoutSession {
  update(props) {
    Object.assign(this, props)
  }

  makeLayout() {
    return new MultiLayout(GranularRectLayout, {
      maxHeight: readConfObject(this.config, 'maxHeight'),
      displayMode: readConfObject(this.config, 'displayMode'),
      pitchX: this.bpPerPx,
      pitchY: 3,
    })
  }

  /**
   * @param {*} layout
   * @returns {boolean} true if the given layout is a valid one to use for this session
   */
  cachedLayoutIsValid(cachedLayout) {
    return (
      cachedLayout &&
      cachedLayout.layout.subLayoutConstructorArgs.pitchX === this.bpPerPx &&
      deepEqual(readConfObject(this.config), cachedLayout.config) &&
      deepEqual(this.filters, cachedLayout.filters) &&
      deepEqual(this.sortObject, cachedLayout.sortObject)
      // deepEqual(this.sortObject.by, cachedLayout.sortedBy)
    )
  }

  get layout() {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      this.cachedLayout = {
        layout: this.makeLayout(),
        config: readConfObject(this.config),
        filters: this.filters,
        sortObject: this.sortObject,
      }
    }
    return this.cachedLayout.layout
  }
}

export default class extends ServerSideRendererType {
  constructor(args) {
    super({ ...args, sessions: {} })
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

  freeResourcesInWorker(args) {
    const { sessionId, region } = args
    const session = this.sessions[sessionId]
    if (!region && session) {
      delete this.sessions[sessionId]
      return 1
    }
    if (session) {
      session.layout.discardRange(region.refName, region.start, region.end)
    }
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
    results.layout = args.layout.serializeRegion(
      this.getExpandedGlyphRegion(args.region, args),
    )
    for (const [k] of features) {
      if (results.layout.rectangles && !results.layout.rectangles[k]) {
        features.delete(k)
      }
    }
    super.serializeResultsInWorker(results, features)
    results.maxHeightReached = results.layout.maxHeightReached
  }
}
