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
import type { LayoutSessionLike, LayoutSessionProps } from './LayoutSession'
import type { RenderReturn } from './RendererType'
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
  layoutWasReset?: boolean
}

export interface ResultsSerialized extends FeatureResultsSerialized {
  maxHeightReached: boolean
  layout: SerializedLayout
  layoutWasReset?: boolean
}

export interface ResultsDeserialized extends FeatureResultsDeserialized {
  maxHeightReached: boolean
  layout: PrecomputedLayout<string>
  layoutWasReset?: boolean
}

export default class BoxRendererType extends FeatureRendererType {
  layoutSessions: Record<string, LayoutSessionLike> = {}

  createLayoutSession(props: LayoutSessionProps): LayoutSessionLike {
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
      // console.log(
      //   `[BoxRendererType.getWorkerSession] created new session: ${key}, ` +
      //     `total sessions: ${Object.keys(this.layoutSessions).length}`,
      // )
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

  freeResources(args: RenderArgs) {
    const specKeys = Object.keys(args)

    // If only sessionId is specified, delete all layout sessions for that session
    if (specKeys.length === 1 && specKeys[0] === 'sessionId') {
      const { sessionId } = args
      for (const key of Object.keys(this.layoutSessions)) {
        if (key.startsWith(`${sessionId}-`)) {
          delete this.layoutSessions[key]
        }
      }
      return
    }

    const key = getLayoutId(args)
    const session = this.layoutSessions[key]
    if (session) {
      const region = args.regions[0]!
      // console.log(
      //   `[BoxRendererType.freeResources] key: ${key}, ` +
      //     `region: ${region.refName}:${region.start}-${region.end}`,
      // )
      session.layout.discardRange(region.refName, region.start, region.end)
    }
    // else {
    //   console.log(
    //     `[BoxRendererType.freeResources] no session found for key: ${key}`,
    //   )
    // }
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
    const session = this.getWorkerSession(args)
    const layout = session.layout.getSublayout(regions[0]!.refName)
    const layoutWasReset = session.checkAndClearLayoutWasReset()
    return { layout, layoutWasReset }
  }

  serializeLayout(layout: BaseLayout<unknown>, args: RenderArgsDeserialized) {
    const region = args.regions[0]!
    return layout.serializeRegion(this.getExpandedRegion(region, args))
  }

  /**
   * Default render method that fetches features and creates layout.
   * Canvas-based renderers should override this and return rpcResult() directly.
   */
  async render(renderArgs: RenderArgsDeserialized): Promise<RenderReturn> {
    const features = await this.getFeatures(renderArgs)
    const { layout, layoutWasReset } = this.createLayoutInWorker(renderArgs)
    return { features, layout, layoutWasReset }
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

    // Live layouts (BaseLayout) have serializeRegion method, plain objects (SerializedLayout) don't
    const layout =
      resultLayout && 'serializeRegion' in resultLayout
        ? resultLayout.serializeRegion(this.getExpandedRegion(region, args))
        : (resultLayout as unknown as SerializedLayout)

    return {
      ...rest,
      layout,
      maxHeightReached: layout.maxHeightReached,
      layoutWasReset: results.layoutWasReset,
      // Filter features to only those visible in the layout
      features: features?.filter(f => !!layout.rectangles[f.uniqueId]),
    }
  }
}
