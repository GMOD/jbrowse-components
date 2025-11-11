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
import type { SimpleFeatureSerialized } from '../../util/simpleFeature'
import type {
  BaseLayout,
  SerializedLayout,
} from '../../util/layouts/BaseLayout'
import type GranularRectLayout from '../../util/layouts/GranularRectLayout'
import type MultiLayout from '../../util/layouts/MultiLayout'

// Default value for feature glyph expansion when not configured
const DEFAULT_MAX_FEATURE_GLYPH_EXPANSION = 0

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

  /**
   * Creates a new layout session with the given properties.
   *
   * @param props - Layout session configuration
   * @returns new LayoutSession instance
   */
  createLayoutSession(props: LayoutSessionProps): LayoutSession {
    return new LayoutSession(props)
  }

  /**
   * Retrieves an existing layout session by its ID.
   *
   * @param props - Session and layout identifiers
   * @returns the layout session, or undefined if not found
   */
  getLayoutSession(props: {
    sessionId: string
    layoutId: string
  }): LayoutSession | undefined {
    return this.layoutSessions[getLayoutId(props)]
  }

  /**
   * Gets or creates a worker layout session. If the session doesn't exist,
   * it creates a new one. Otherwise, updates the existing session.
   *
   * @param props - Layout session properties with identifiers
   * @returns updated layout session
   */
  getWorkerSession(
    props: LayoutSessionProps & { sessionId: string; layoutId: string },
  ): LayoutSession {
    const key = getLayoutId(props)

    if (!this.layoutSessions[key]) {
      this.layoutSessions[key] = this.createLayoutSession(props)
    }

    return this.layoutSessions[key]!.update(props)
  }

  /**
   * Expands a region to account for feature glyph rendering that may extend
   * beyond the exact feature boundaries.
   *
   * @param region - The region to expand
   * @param renderArgs - Rendering arguments containing config and scale
   * @returns expanded region with adjusted start/end coordinates
   */
  getExpandedRegion(
    region: Region,
    renderArgs: RenderArgsDeserialized,
  ): Region {
    const { bpPerPx, config } = renderArgs

    const maxFeatureGlyphExpansion =
      readConfObject(config, 'maxFeatureGlyphExpansion') ||
      DEFAULT_MAX_FEATURE_GLYPH_EXPANSION

    const bpExpansion = Math.round(maxFeatureGlyphExpansion * bpPerPx)

    return {
      ...(region as Omit<typeof region, symbol>),
      start: Math.floor(Math.max(region.start - bpExpansion, 0)),
      end: Math.ceil(region.end + bpExpansion),
    }
  }

  /**
   * Helper method to discard a layout range for a given session.
   * Extracts common logic used by both client and worker resource freeing.
   *
   * @param args - Arguments containing regions and layout identifiers
   */
  private discardLayoutRange(args: {
    regions: Region[]
    sessionId: string
    layoutId: string
  }): void {
    const { regions } = args

    // Nothing to discard if no regions
    if (!regions.length) {
      return
    }

    const key = getLayoutId(args)
    const session = this.layoutSessions[key]

    if (!session) {
      return
    }

    const region = regions[0]
    if (region) {
      session.layout.discardRange(region.refName, region.start, region.end)
    }
  }

  /**
   * Frees resources in the worker. Called via RPC from the client.
   * This is an alias for freeResourcesInWorker to maintain backward compatibility.
   *
   * @param args - Arguments containing regions and layout identifiers
   */
  freeResources(args: RenderArgsDeserialized): void {
    this.freeResourcesInWorker(args)
  }

  /**
   * Frees layout resources in the worker by discarding the specified region.
   *
   * @param args - Arguments containing regions and layout identifiers
   */
  freeResourcesInWorker(args: RenderArgsDeserialized): void {
    this.discardLayoutRange(args)
  }

  /**
   * Frees layout resources in the client and forwards the request to the worker.
   *
   * @param rpcManager - RPC manager for worker communication
   * @param args - Arguments containing regions and layout identifiers
   */
  async freeResourcesInClient(
    rpcManager: RpcManager,
    args: RenderArgs,
  ): Promise<void> {
    this.discardLayoutRange(args)
    return super.freeResourcesInClient(rpcManager, args)
  }

  /**
   * Deserializes a layout from JSON in the client.
   *
   * @param json - Serialized layout data
   * @returns PrecomputedLayout instance
   */
  deserializeLayoutInClient(json: SerializedLayout): PrecomputedLayout<string> {
    return new PrecomputedLayout(json)
  }

  /**
   * Deserializes render results in the client, including the layout.
   *
   * @param result - Serialized results from the worker
   * @param args - Original render arguments
   * @returns deserialized results with PrecomputedLayout
   */
  deserializeResultsInClient(
    result: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    const layout = this.deserializeLayoutInClient(result.layout)

    const deserializedResult = super.deserializeResultsInClient(
      {
        ...result,
        layout,
      } as FeatureResultsSerialized,
      args,
    ) as ResultsDeserialized

    return deserializedResult
  }

  /**
   * Creates or retrieves a layout for rendering in the worker.
   * Gets the appropriate sublayout for the first region's reference sequence.
   *
   * @param args - Deserialized render arguments
   * @returns layout for the specified region
   * @throws if no regions are provided
   */
  createLayoutInWorker(args: RenderArgsDeserialized): BaseLayout<Feature> {
    const { regions } = args

    if (!regions.length) {
      throw new Error('Cannot create layout: no regions provided')
    }

    const region = regions[0]
    if (!region) {
      throw new Error('Cannot create layout: first region is undefined')
    }

    const { layout } = this.getWorkerSession(args)
    return layout.getSublayout(region.refName)
  }

  /**
   * Serializes render results in the worker, including layout information.
   * Filters features to only include those that have rectangles in the layout.
   *
   * @param results - Render results to serialize
   * @param args - Deserialized render arguments
   * @returns serialized results with layout
   */
  serializeResultsInWorker(
    results: RenderResults,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const { features, ...rest } = super.serializeResultsInWorker(
      results,
      args,
    ) as ResultsSerialized

    const region = args.regions[0]
    if (!region) {
      throw new Error('No region provided for serialization')
    }

    const expandedRegion = this.getExpandedRegion(region, args)
    const layout = results.layout.serializeRegion(expandedRegion)

    // Filter features to only those with layout rectangles.
    // Floating layouts don't have rectangles, so all features are included.
    const filteredFeatures = this.filterFeaturesByLayout(features, layout)

    return {
      ...rest,
      layout,
      maxHeightReached: layout.maxHeightReached,
      features: filteredFeatures,
    }
  }

  /**
   * Filters features based on whether they have corresponding layout rectangles.
   * Used to exclude features that weren't successfully laid out.
   *
   * @param features - Serialized features to filter
   * @param layout - Serialized layout containing rectangle information
   * @returns filtered features that have layout rectangles
   */
  private filterFeaturesByLayout(
    features: SimpleFeatureSerialized[],
    layout: SerializedLayout,
  ): SimpleFeatureSerialized[] {
    // Floating layouts have no rectangles, so include all features
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (layout.rectangles === undefined) {
      return features
    }

    // Only include features that have rectangles in the layout
    return features.filter(f => !!layout.rectangles[f.uniqueId])
  }

  /**
   * Renders features with box layout. Creates a layout if one isn't provided,
   * then delegates to the parent renderer.
   *
   * @param props - Deserialized render arguments
   * @returns render results including the layout used
   */
  async render(props: RenderArgsDeserialized): Promise<RenderResults> {
    // Use provided layout or create a new one for the worker
    const layout: BaseLayout<unknown> =
      (props.layout as undefined | BaseLayout<unknown>) ||
      this.createLayoutInWorker(props)

    // Perform the actual rendering with the layout
    const result = await super.render({
      ...props,
      layout,
    })

    // Include the layout in the results
    // Cast to Feature since we know this is a BaseLayout for features
    return {
      ...result,
      layout: layout as BaseLayout<Feature>,
    }
  }
}
