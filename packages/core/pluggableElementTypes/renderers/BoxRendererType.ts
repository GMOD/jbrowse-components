import deepEqual from 'deep-equal'
import { AnyConfigurationModel } from '../../configuration/configurationSchema'
import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'
import PrecomputedLayout from '../../util/layouts/PrecomputedLayout'
import { Feature } from '../../util/simpleFeature'
import ServerSideRendererType, {
  ResultsSerialized as BaseResultsSerialized,
  RenderArgs,
  RenderArgsSerialized,
  ResultsDeserialized as BaseResultsDeserialized,
  RenderArgsDeserialized as BaseRenderArgsDeserialized,
  RenderResults,
} from './ServerSideRendererType'
import { IRegion } from '../../mst-types'
import { SerializedLayout, BaseLayout } from '../../util/layouts/BaseLayout'
import { readConfObject, isConfigurationModel } from '../../configuration'
import SerializableFilterChain from './util/serializableFilterChain'

interface LayoutSessionProps {
  config: AnyConfigurationModel
  bpPerPx: number
  filters: SerializableFilterChain
}

type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>
interface CachedLayout {
  layout: MyMultiLayout
  config: AnyConfigurationModel
  filters: SerializableFilterChain
}

export class LayoutSession implements LayoutSessionProps {
  config: AnyConfigurationModel

  bpPerPx: number

  filters: SerializableFilterChain

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

    // // debugging aid: check if there are features in `features` that are not in the layout
    // const featureIds1 = iterMap(deserialized.features.values(), f =>
    //   f.id(),
    // ).sort()
    // const featureIds2 = Object.keys(
    //   deserialized.layout.toJSON().rectangles,
    // ).sort()
    // if (
    //   featureIds1.length > featureIds2.length &&
    //   !deserialized.layout.maxHeightReached
    // )
    //   debugger

    return deserialized
  }

  deserializeLayoutInWorker(args: RenderArgsDeserialized & LayoutSessionProps) {
    const { regions } = args
    const session = this.getWorkerSession(args)
    const subLayout = session.layout.getSublayout(regions[0].refName)
    return subLayout
  }

  deserializeArgsInWorker(
    args: RenderArgsSerialized & LayoutSessionProps,
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

    const [region] = args.regions
    serialized.layout = args.layout.serializeRegion(
      this.getExpandedGlyphRegion(region, args),
    )
    if (serialized.layout.rectangles) {
      serialized.features = serialized.features.filter(f => {
        return Boolean(serialized.layout.rectangles[f.uniqueId])
      })
    }

    serialized.maxHeightReached = serialized.layout.maxHeightReached
    return serialized
  }
}
