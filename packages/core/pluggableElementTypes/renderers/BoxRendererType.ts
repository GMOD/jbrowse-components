import FeatureRendererType from './FeatureRendererType'
import { LayoutSession } from './LayoutSession'
import { expandRegion } from './util'
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
export interface RenderArgs extends FeatureRenderArgs {
  bpPerPx: number
  layoutId: string
}

export interface RenderArgsSerialized extends FeatureRenderArgsSerialized {
  bpPerPx: number
}

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  statusCallback?: (arg: string) => void
  bpPerPx: number
  layoutId: string
}

export interface RenderResults extends FeatureRenderResults {
  layout?: BaseLayout<Feature> | SerializedLayout
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
    return expandRegion(region, bpExpansion)
  }

  freeResources(args: Record<string, string>) {
    const key = getLayoutId(args)
    const session = this.layoutSessions[key]
    if (session) {
      const region = (args as unknown as RenderArgs).regions[0]!
      session.layout.discardRange(region.refName, region.start, region.end)
    }
  }

  async freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    this.freeResources(args)
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

  serializeLayout(layout: BaseLayout<unknown>, args: RenderArgsDeserialized) {
    const region = args.regions[0]!
    return layout.serializeRegion(this.getExpandedRegion(region, args))
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
    const resultLayout = results.layout

    // Layout may already be serialized (e.g., from canvas renderers during SVG export)
    const layout =
      typeof resultLayout?.serializeRegion === 'function'
        ? resultLayout.serializeRegion(this.getExpandedRegion(region, args))
        : (resultLayout as unknown as SerializedLayout)

    return {
      ...rest,
      layout,
      maxHeightReached: layout.maxHeightReached,
      // Filter features to only those visible in the layout (if features exist)
      features:
        features && layout.rectangles
          ? features.filter(f => !!layout.rectangles[f.uniqueId])
          : features,
    }
  }
}
