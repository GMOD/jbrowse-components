import deepEqual from 'deep-equal'
import {
  readConfObject,
  AnyConfigurationModel,
  isConfigurationModel,
} from '../../configuration'
import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'
import PrecomputedLayout from '../../util/layouts/PrecomputedLayout'
import { Feature } from '../../util/simpleFeature'
import ServerSideRendererType, {
  ResultsSerialized as BaseResultsSerialized,
  RenderArgs,
  ResultsDeserialized as BaseResultsDeserialized,
  isSingleRegionRenderArgs,
  RenderArgsDeserialized as BaseRenderArgsDeserialized,
  RenderResults,
} from './ServerSideRendererType'
import { IRegion } from '../../mst-types'
import { SerializedLayout, BaseLayout } from '../../util/layouts/BaseLayout'

interface LayoutSessionProps {
  config: AnyConfigurationModel
  bpPerPx: number
  filters?: any
}

type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>
interface CachedLayout {
  layout: MyMultiLayout
  config: AnyConfigurationModel
  filters: any
}

export class LayoutSession implements LayoutSessionProps {
  config: AnyConfigurationModel

  bpPerPx: number

  filters: any

  constructor(args: LayoutSessionProps) {
    this.config = args.config
    if (!isConfigurationModel(this.config)) {
      throw new Error('configuration required')
    }
    this.bpPerPx = args.bpPerPx
    this.filters = args.filters
    this.update(args)
  }

  update(props: LayoutSessionProps) {
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
  cachedLayoutIsValid(cachedLayout: CachedLayout) {
    return (
      cachedLayout &&
      cachedLayout.layout.subLayoutConstructorArgs.pitchX === this.bpPerPx &&
      deepEqual(readConfObject(this.config), cachedLayout.config) &&
      deepEqual(this.filters, cachedLayout.filters)
    )
  }

  cachedLayout: CachedLayout | undefined

  get layout(): MyMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      this.cachedLayout = {
        layout: this.makeLayout(),
        config: readConfObject(this.config),
        filters: this.filters,
      }
    }
    return this.cachedLayout.layout
  }
}

/// *****************************************************************************
/// *****************************************************************************
/// *****************************************************************************

type ResultsDeserialized = BaseResultsDeserialized & {
  layout: PrecomputedLayout<string>
}

type RenderArgsDeserialized = BaseRenderArgsDeserialized & {
  layout: BaseLayout<unknown>
}

type ResultsSerialized = BaseResultsSerialized & {
  maxHeightReached: boolean
  layout: SerializedLayout
}

export default class BoxRendererType extends ServerSideRendererType {
  sessions: { [sessionId: string]: LayoutSession } = {}

  getWorkerSession(props: LayoutSessionProps & { sessionId: string }) {
    const { sessionId } = props
    if (!this.sessions[sessionId])
      this.sessions[sessionId] = this.createSession(props)
    const session = this.sessions[sessionId]
    session.update(props)
    return session
  }

  createSession(props: LayoutSessionProps) {
    return new LayoutSession(props)
  }

  freeResourcesInWorker(args: {
    sessionId: string
    region: IRegion | undefined
  }) {
    const { sessionId, region } = args
    const session = this.sessions[sessionId]
    if (!region && session) {
      delete this.sessions[sessionId]
      return 1
    }
    if (session && region) {
      session.layout.discardRange(region.refName, region.start, region.end)
    }
    return 0
  }

  deserializeLayoutInClient(json: SerializedLayout) {
    return new PrecomputedLayout(json)
  }

  deserializeResultsInClient(
    result: ResultsSerialized & { layout: SerializedLayout },
    args: RenderArgs,
  ) {
    const deserialized = super.deserializeResultsInClient(
      result,
      args,
    ) as ResultsDeserialized
    deserialized.layout = this.deserializeLayoutInClient(result.layout)
    return deserialized
  }

  deserializeLayoutInWorker(args: RenderArgsDeserialized & LayoutSessionProps) {
    if (isSingleRegionRenderArgs(args)) {
      const { region } = args
      const session = this.getWorkerSession(args)
      const subLayout = session.layout.getSublayout(region.refName)
      return subLayout
    }
    throw new Error('invalid render args type')
  }

  deserializeArgsInWorker(
    args: RenderArgs & LayoutSessionProps,
  ): RenderArgsDeserialized {
    const deserialized = super.deserializeArgsInWorker(
      args,
    ) as RenderArgsDeserialized
    deserialized.layout = this.deserializeLayoutInWorker(deserialized)
    return deserialized
  }

  serializeResultsInWorker(
    results: RenderResults,
    features: Map<string, Feature>,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const serialized = super.serializeResultsInWorker(
      results,
      features,
      args,
    ) as ResultsSerialized

    if (isSingleRegionRenderArgs(args)) {
      serialized.layout = args.layout.serializeRegion(
        this.getExpandedGlyphRegion(args.region, args),
      )
      for (const [k] of features) {
        if (serialized.layout.rectangles && !serialized.layout.rectangles[k]) {
          features.delete(k)
        }
      }

      serialized.maxHeightReached = serialized.layout.maxHeightReached
      return serialized
    }
    throw new Error('invalid render args type')
  }
}
