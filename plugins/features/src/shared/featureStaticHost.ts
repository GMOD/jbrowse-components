import { fullConfSnapshot } from '@jbrowse/core/configuration'
import { overByteLimitError } from '@jbrowse/core/data_adapters/tables'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import {
  fitTargetHeightViews,
  grownHeightViews,
  heightModeViews,
} from '@jbrowse/display-kit/HeightModeMixin'
import { hiddenGroupsViews } from '@jbrowse/display-kit/HiddenGroupsMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { trackCanvasWidthPx } from '@jbrowse/display-kit/foundationView'
import { types } from '@jbrowse/mobx-state-tree'
import { runInAction } from 'mobx'

import {
  basicDisplayGlyphViews,
  basicDisplayLayoutViews,
  featureDisplayConfigViews,
  hiddenSectionViews,
} from '../LinearBasicDisplay/basicDisplayLayoutViews.ts'
import configSchemaFactory from '../LinearBasicDisplay/configSchema.ts'
import { featureColorScaleViews } from '../LinearBasicDisplay/derivedColorKey.ts'
import { featureBandViews } from '../LinearBasicDisplay/featureBandViews.ts'
import { heightViews } from '../LinearBasicDisplay/heightViews.ts'
import { layoutRegionKey } from '../LinearBasicDisplay/layoutInputs.ts'
import { featureIdsTouchingBlocks } from '../LinearBasicDisplay/layoutQueries.ts'
import {
  featureRenderStateViews,
  groupLabelViews,
} from '../LinearBasicDisplay/renderStateViews.ts'
import { executeRenderFeatureData } from '../RenderFeatureDataRPC/executeRenderFeatureData.ts'
import { createPeptideCache } from '../RenderFeatureDataRPC/peptides/peptideCache.ts'
import { pickDisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import { featureColorViews } from './featureColorViews.ts'

import type { LayoutRegionData } from '../LinearBasicDisplay/layoutInputs.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * What a static feature host reads off the view it stands in for: the zoom
 * it lays out at, the blocks on screen and the width its canvas spans.
 */
export interface FeatureStaticFrame {
  bpPerPx: number
  coarseBpPerPx: number
  trackWidthPx: number
  settledDynamicBlocks: readonly {
    assemblyName: string
    refName: string
    start: number
    end: number
    widthPx: number
  }[]
}

const NO_FRAME: FeatureStaticFrame = {
  bpPerPx: 1,
  coarseBpPerPx: 1,
  trackWidthPx: 0,
  settledDynamicBlocks: [],
}

const NO_FEATURE_IDS: ReadonlySet<string> = new Set()

/**
 * A `LinearBasicDisplay` reduced to its config node, and as volatiles the
 * frame it lays out in and what was fetched over it, under the views layers
 * the display installs, in the display's order. No session, no view, no
 * autoruns: nothing is pinned or expanded, no density gate measured, and the
 * track is unscrolled. The tables and the static SVG export both run it.
 */
const FeatureStaticHostModel = types
  .compose(
    'FeatureStaticHost',
    TrackHeightMixin(),
    types.model({ id: types.string, configuration: configSchemaFactory() }),
  )
  .volatile(() => ({
    host: NO_FRAME,
    rpcDataMap: new Map<number, LayoutRegionData>(),
    layoutPinnedFeatureIdSet: NO_FEATURE_IDS,
    expandedGeneIdSet: NO_FEATURE_IDS,
    visibleFeatureDensityPerPx: 0,
    morphFromTops: undefined,
    morphFromMaxY: 0,
  }))
  .actions(self => ({
    setFrame(host: FeatureStaticFrame) {
      self.host = host
    },
    setRpcDataMap(rpcDataMap: Map<number, LayoutRegionData>) {
      self.rpcDataMap = rpcDataMap
    },
  }))
  .views(self => ({
    get conf() {
      return self.configuration
    },
    get canvasWidthPx() {
      return trackCanvasWidthPx(self.host)
    },
    get layoutReady() {
      return self.rpcDataMap.size > 0
    },
    get onScreenWidthPx() {
      return self.host.settledDynamicBlocks.reduce(
        (sum, b) => sum + b.widthPx,
        0,
      )
    },
    get hidesOverflow() {
      return false
    },
    get hostInitialized() {
      return true
    },
  }))
  .views(self => heightModeViews(self))
  .views(self => fitTargetHeightViews(self))
  .views(self => featureDisplayConfigViews(self))
  .views(self => hiddenGroupsViews(self))
  .views(self => hiddenSectionViews(self))
  .views(featureColorViews)
  .views(self => ({
    get onScreenFeatureIds() {
      return featureIdsTouchingBlocks(
        self.rpcDataMap.values(),
        self.host.settledDynamicBlocks,
        self.hiddenGroupFeatureIds,
      )
    },
  }))
  .views(self => basicDisplayGlyphViews(self))
  .views(self => basicDisplayLayoutViews(self))
  .views(featureBandViews)
  .views(self => groupLabelViews(self))
  .views(self => heightViews(self))
  .views(self => grownHeightViews(self))
  .views(self => featureRenderStateViews(self))
  .views(self => featureColorScaleViews(self))

export interface FeatureStaticHost extends Instance<
  typeof FeatureStaticHostModel
> {}

/**
 * The static host for a feature display, `display` its config as a track's
 * `displays` entry writes it for a `LinearBasicDisplay`.
 */
export function createFeatureStaticHost({
  id,
  display,
  pluginManager,
}: {
  id: string
  display: Record<string, unknown>
  pluginManager: PluginManager
}) {
  return FeatureStaticHostModel.create(
    {
      id,
      configuration: { ...display, type: 'LinearBasicDisplay', displayId: id },
    },
    { pluginManager },
  )
}

export interface FeatureFetchArgs {
  adapterConfig: Record<string, unknown>
  /** The assembly's sequence adapter, for a CDS painted by reading frame. */
  sequenceAdapter?: Record<string, unknown>
  /** Paint each CDS by its reading frame, as the view's "Color by CDS" does. */
  colorByFrame?: boolean
  /** Translate each CDS once the zoom reaches a base a px, as the view does. */
  aminoAcids?: boolean
  /** The genetic code for a CDS whose feature names no `transl_table`. */
  geneticCodeId?: number
  /** The most compressed bytes a region may need, refused off the index. */
  byteLimit: number
}

/**
 * The display's fetch over `regions` at the frame's zoom, run in-process, its
 * results set on `host` keyed by each region's `index`: the inputs the worker
 * reads off the display in one batch, then one `RenderFeatureData` per
 * region. A region over `byteLimit` throws, naming its `requested` region
 * where the fetch widens one. Returns the config the fetch read.
 */
export async function fetchFeatureRegions(
  pluginManager: PluginManager,
  host: FeatureStaticHost,
  regions: readonly { region: Region; index: number; requested?: Region }[],
  {
    adapterConfig,
    sequenceAdapter,
    colorByFrame = false,
    aminoAcids = true,
    geneticCodeId,
    byteLimit,
  }: FeatureFetchArgs,
) {
  const { config, displayConfig, geneGlyphMode, bpPerPx } = runInAction(() => {
    const config = fullConfSnapshot(host.configuration)
    const { facet } = host
    return {
      config,
      displayConfig: {
        ...pickDisplayConfig(config),
        subfeatureLabels: host.effectiveSubfeatureLabels,
        ...(facet === undefined || facet.field === STRAND_FIELD
          ? {}
          : { facetField: facet.field }),
      },
      geneGlyphMode: host.effectiveGeneGlyphMode,
      bpPerPx: host.host.bpPerPx,
    }
  })
  const peptideCache = createPeptideCache()
  const fetched = await Promise.all(
    regions.map(
      async ({
        region,
        index,
        requested = region,
      }): Promise<[number, LayoutRegionData]> => {
        const result = await executeRenderFeatureData({
          pluginManager,
          peptideCache,
          args: {
            sessionId: host.id,
            adapterConfig,
            sequenceAdapter,
            region,
            displayConfig,
            geneGlyphMode,
            bpPerPx,
            colorByFrame,
            peptides: aminoAcids && shouldRenderPeptideBackground(bpPerPx),
            geneticCodeId,
            byteLimit,
            statusCallback: () => {},
          } satisfies RpcExecuteArgs<'RenderFeatureData'>,
        })
        if ('regionTooLarge' in result) {
          throw overByteLimitError(
            [requested],
            result.bytes,
            byteLimit,
            'features',
          )
        }
        return [
          index,
          {
            ...result.value,
            regionKey: layoutRegionKey(region),
            regionStart: region.start,
            regionEnd: region.end,
            reversed: !!region.reversed,
          },
        ]
      },
    ),
  )
  host.setRpcDataMap(new Map(fetched))
  return config
}
