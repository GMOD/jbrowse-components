import deepEqual from 'fast-deep-equal'

// layouts
import FeatureRendererType from './FeatureRendererType'
import { readConfObject } from '../../configuration'
import { getLayoutId } from '../../util'
import GranularRectLayout from '../../util/layouts/GranularRectLayout'
import MultiLayout from '../../util/layouts/MultiLayout'
import PrecomputedLayout from '../../util/layouts/PrecomputedLayout'

// other
import type {
  RenderArgs as FeatureRenderArgs,
  RenderArgsSerialized as FeatureRenderArgsSerialized,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
  RenderResults as FeatureRenderResults,
  ResultsSerialized as FeatureResultsSerialized,
  ResultsDeserialized as FeatureResultsDeserialized,
} from './FeatureRendererType'
import type { AnyConfigurationModel } from '../../configuration'
import type { Region, Feature } from '../../util'
import type SerializableFilterChain from './util/serializableFilterChain'
import type RpcManager from '../../rpc/RpcManager'
import type {
  SerializedLayout,
  BaseLayout,
} from '../../util/layouts/BaseLayout'

export interface LayoutSessionProps {
  config: AnyConfigurationModel
  bpPerPx: number
  filters?: SerializableFilterChain
}

export type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>

export interface CachedLayout {
  layout: MyMultiLayout
  config: AnyConfigurationModel
  filters?: SerializableFilterChain
}

export class LayoutSession implements LayoutSessionProps {
  config: AnyConfigurationModel

  bpPerPx: number

  filters?: SerializableFilterChain

  constructor(args: LayoutSessionProps) {
    this.config = args.config
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
      pitchY: readConfObject(this.config, 'noSpacing') ? 1 : 3,
    })
  }

  /**
   * @param layout -
   * @returns true if the given layout is a valid one to use for this session
   */
  cachedLayoutIsValid(cachedLayout: CachedLayout) {
    return (
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
export interface RenderArgs extends FeatureRenderArgs {
  bpPerPx: number
  layoutId: string
}

export interface RenderArgsSerialized extends FeatureRenderArgsSerialized {
  bpPerPx: number
}

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  layoutId: string
}

export interface RenderResults extends FeatureRenderResults {
  layout: BaseLayout<Feature>
}

export interface ResultsSerialized extends FeatureResultsSerialized {
  maxHeightReached: boolean
  layout: SerializedLayout
}

export interface ResultsDeserialized extends FeatureResultsDeserialized {
  maxHeightReached: boolean
  layout: PrecomputedLayout<string>
}

export default class BoxRendererType extends FeatureRendererType {
  sessions: Record<string, LayoutSession> = {}

  getWorkerSession(
    props: LayoutSessionProps & { sessionId: string; layoutId: string },
  ) {
    const key = getLayoutId(props)
    if (!this.sessions[key]) {
      this.sessions[key] = this.createSession(props)
    }
    const session = this.sessions[key]
    session.update(props)
    return session
  }

  getExpandedRegion(region: Region, renderArgs: RenderArgsDeserialized) {
    const { bpPerPx, config } = renderArgs
    const maxFeatureGlyphExpansion =
      readConfObject(config, 'maxFeatureGlyphExpansion') || 0
    const bpExpansion = Math.round(maxFeatureGlyphExpansion * bpPerPx)
    return {
      ...(region as Omit<typeof region, symbol>),
      start: Math.floor(Math.max(region.start - bpExpansion, 0)),
      end: Math.ceil(region.end + bpExpansion),
    }
  }

  createSession(props: LayoutSessionProps) {
    return new LayoutSession(props)
  }

  async freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    const { regions } = args
    const key = getLayoutId(args)
    const session = this.sessions[key]
    if (session) {
      const region = regions[0]!
      session.layout.discardRange(region.refName, region.start, region.end)
    }
    return await super.freeResourcesInClient(rpcManager, args)
  }

  deserializeLayoutInClient(json: SerializedLayout) {
    return new PrecomputedLayout(json)
  }

  deserializeResultsInClient(result: ResultsSerialized, args: RenderArgs) {
    const layout = this.deserializeLayoutInClient(result.layout)
    return super.deserializeResultsInClient(
      { ...result, layout } as FeatureResultsSerialized,
      args,
    ) as ResultsDeserialized
  }

  createLayoutInWorker(args: RenderArgsDeserialized) {
    const { regions } = args
    const session = this.getWorkerSession(args)
    return session.layout.getSublayout(regions[0]!.refName)
  }

  serializeResultsInWorker(
    results: RenderResults,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const serialized = super.serializeResultsInWorker(
      results,
      args,
    ) as ResultsSerialized

    const region = args.regions[0]!
    serialized.layout = results.layout.serializeRegion(
      this.getExpandedRegion(region, args),
    )
    serialized.features = serialized.features.filter(f => {
      return Boolean(serialized.layout.rectangles[f.uniqueId])
    })

    serialized.maxHeightReached = serialized.layout.maxHeightReached
    return serialized
  }

  /**
   * gets layout and renders
   *
   * @param props - render args
   */
  async render(props: RenderArgsDeserialized): Promise<RenderResults> {
    const layout =
      (props.layout as undefined | BaseLayout<unknown>) ||
      this.createLayoutInWorker(props)
    const result = await super.render({ ...props, layout })
    return { ...result, layout }
  }
}
