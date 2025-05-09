import FeatureRendererType from './FeatureRendererType'
import { LayoutSession } from './LayoutSession'
import { readConfObject } from '../../configuration'
import { getLayoutId } from '../../util'
import PrecomputedLayout from '../../util/layouts/PrecomputedLayout'

import type {
  RenderArgs as FeatureRenderArgs,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
  RenderArgsSerialized as FeatureRenderArgsSerialized,
  RenderResults as FeatureRenderResults,
  ResultsDeserialized as FeatureResultsDeserialized,
  ResultsSerialized as FeatureResultsSerialized,
} from './FeatureRendererType'
import type { LayoutSessionProps } from './LayoutSession'
import type RpcManager from '../../rpc/RpcManager'
import type { Feature, Region } from '../../util'
import type {
  BaseLayout,
  SerializedLayout,
} from '../../util/layouts/BaseLayout'
import type GranularRectLayout from '../../util/layouts/GranularRectLayout'
import type MultiLayout from '../../util/layouts/MultiLayout'

export type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>

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
  layoutSessions: Record<string, LayoutSession> = {}

  createLayoutSession(props: LayoutSessionProps) {
    return new LayoutSession(props)
  }

  getLayoutSession(props: { sessionId: string; layoutId: string }) {
    return this.layoutSessions[getLayoutId(props)]
  }

  getWorkerSession(
    props: LayoutSessionProps & { sessionId: string; layoutId: string },
  ) {
    const key = getLayoutId(props)
    if (!this.layoutSessions[key]) {
      this.layoutSessions[key] = this.createLayoutSession(props)
    }
    return this.layoutSessions[key].update(props)
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

  // renaming function to make clear it runs in worker
  freeResources(args: Record<string, any>) {
    this.freeResourcesInWorker(args)
  }

  freeResourcesInWorker(args: Record<string, any>) {
    const { regions } = args

    // @ts-expect-error
    const key = getLayoutId(args)
    const session = this.layoutSessions[key]

    if (session) {
      const region = regions[0]!
      session.layout.discardRange(region.refName, region.start, region.end)
    }
  }

  async freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    const { regions } = args
    const key = getLayoutId(args)
    const session = this.layoutSessions[key]

    if (session) {
      const region = regions[0]!
      session.layout.discardRange(region.refName, region.start, region.end)
    }
    return super.freeResourcesInClient(rpcManager, args)
  }

  deserializeLayoutInClient(json: SerializedLayout) {
    return new PrecomputedLayout(json)
  }

  deserializeResultsInClient(result: ResultsSerialized, args: RenderArgs) {
    const layout = this.deserializeLayoutInClient(result.layout)
    return super.deserializeResultsInClient(
      {
        ...result,
        layout,
      } as FeatureResultsSerialized,
      args,
    ) as ResultsDeserialized
  }

  createLayoutInWorker(args: RenderArgsDeserialized) {
    const { regions } = args
    const { layout } = this.getWorkerSession(args)
    return layout.getSublayout(regions[0]!.refName)
  }

  serializeResultsInWorker(
    results: RenderResults,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const { features, ...rest } = super.serializeResultsInWorker(
      results,
      args,
    ) as ResultsSerialized

    const region = args.regions[0]!
    const layout = results.layout.serializeRegion(
      this.getExpandedRegion(region, args),
    )
    return {
      ...rest,
      layout,
      maxHeightReached: layout.maxHeightReached,
      features:
        // floating layout has no rectangles
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        layout.rectangles !== undefined
          ? features.filter(f => !!layout.rectangles[f.uniqueId])
          : features,
    }
  }

  async render(props: RenderArgsDeserialized): Promise<RenderResults> {
    const layout =
      (props.layout as undefined | BaseLayout<unknown>) ||
      this.createLayoutInWorker(props)
    const result = await super.render({
      ...props,
      layout,
    })
    return {
      ...result,
      layout,
    }
  }
}
