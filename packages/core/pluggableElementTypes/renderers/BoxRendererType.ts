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
import { Region } from '../../util/types'
import { SerializedLayout, BaseLayout } from '../../util/layouts/BaseLayout'
import { readConfObject, isConfigurationModel } from '../../configuration'
import SerializableFilterChain from './util/serializableFilterChain'

export interface LayoutSessionProps {
  config: AnyConfigurationModel
  bpPerPx: number
  filters: SerializableFilterChain
}

export type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>
export interface CachedLayout {
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
   * @param layout -
   * @returns true if the given layout is a valid one to use for this session
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

  // expands region for glyphs to use
  getExpandedRegion(region: Region, renderArgs: RenderArgsDeserialized) {
    if (!region) return region
    const { bpPerPx, config } = renderArgs
    const maxFeatureGlyphExpansion =
      config === undefined
        ? 0
        : readConfObject(config, 'maxFeatureGlyphExpansion')
    if (!maxFeatureGlyphExpansion) return region
    const bpExpansion = Math.round(maxFeatureGlyphExpansion * bpPerPx)
    return {
      ...region,
      start: Math.floor(Math.max(region.start - bpExpansion, 0)),
      end: Math.ceil(region.end + bpExpansion),
    }
  }

  createSession(props: LayoutSessionProps) {
    return new LayoutSession(props)
  }

  freeResourcesInWorker(args: {
    sessionId: string
    regions: Region[] | undefined
  }) {
    const { sessionId, regions } = args
    const session = this.sessions[sessionId]
    if (!regions && session) {
      delete this.sessions[sessionId]
      return 1
    }
    if (session && regions) {
      session.layout.discardRange(
        regions[0].refName,
        regions[0].start,
        regions[0].end,
      )
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
      this.getExpandedRegion(region, args),
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
