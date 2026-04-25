import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  getConfSnapshot,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getSession,
  isFeature,
  isSessionModelWithWidgets,
  measureText,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun, observable } from 'mobx'

import { computeLaidOutData } from './layout.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { CanvasFeatureBackend } from './components/canvasFeatureBackendTypes.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

type LoadedFeatureData = FeatureDataResult & { loadedBpPerPx: number }

function findSubfeatureById(
  feature: Feature,
  targetId: string,
): Feature | undefined {
  const subfeatures = feature.get('subfeatures')
  if (subfeatures) {
    for (const sub of subfeatures) {
      if (sub.id() === targetId) {
        return sub
      }
      const found = findSubfeatureById(sub, targetId)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

export type { Region } from '@jbrowse/core/util'

async function fetchCanvasFeatureDetails(
  session: {
    rpcManager: RpcManager
    notifyError: (msg: string, err?: unknown) => void
  },
  sessionId: string,
  adapterConfig: Record<string, unknown>,
  featureId: string,
  region: Region,
) {
  try {
    const result = await session.rpcManager.call(
      sessionId,
      'GetCanvasFeatureDetails',
      { sessionId, adapterConfig, featureId, region },
    )
    return result.feature ? new SimpleFeature(result.feature) : undefined
  } catch (e) {
    console.error('Failed to fetch feature details:', e)
    session.notifyError(`${e}`, e)
    return undefined
  }
}

const FeatureComponent = lazy(() => import('./components/FeatureComponent.tsx'))

const DESCRIPTION_DENSITY_THRESHOLD = 0.2

// Shared GPU-accelerated feature display base for canvas-rendered tracks.
// Handles fetching, layout, the "Show labels" / "Show descriptions" UI, and
// the fetch-invalidation autorun. Subclasses (LinearBasicDisplay,
// LinearVariantDisplay, ...) layer their own schema-specific property,
// menu, and RPC extensions on top via the two extension hooks below
// (displayConfigOverrides / extraRpcArgs) and the showSubmenuMenuItems /
// trackMenuItems / contextMenuItems super-extension pattern.
export default function baseStateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return (
    types
      .compose(
        'LinearCanvasBaseDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        ConfigOverrideMixin(),
        types.model({
          configuration: ConfigurationReference(configSchema),
        }),
      )
      // Migrate legacy snapshot shapes: strip removed FeatureDensityMixin
      // fields, lift `height` to `heightPreConfig`, and promote the old
      // per-property `track<Setting>` values into the unified configOverrides
      // map.
      .preProcessSnapshot((snap: any) => {
        if (!snap) {
          return snap
        }
        const {
          blockState,
          showLegend,
          showTooltips,
          userBpPerPxLimit,
          userByteSizeLimit,
          height,
          trackShowLabels,
          trackShowDescriptions,
          trackSubfeatureLabels,
          trackGeneGlyphMode,
          trackDisplayMode,
          trackDisplayDirectionalChevrons,
          ...rest
        } = snap

        const migrated: Record<string, unknown> = {}
        if (trackShowLabels !== undefined) {
          migrated.showLabels = trackShowLabels
        }
        if (trackShowDescriptions !== undefined) {
          migrated.showDescriptions = trackShowDescriptions
        }
        if (trackSubfeatureLabels !== undefined) {
          migrated.subfeatureLabels = trackSubfeatureLabels
        }
        if (trackGeneGlyphMode !== undefined) {
          migrated.geneGlyphMode = trackGeneGlyphMode
        }
        if (trackDisplayMode !== undefined) {
          migrated.displayMode = trackDisplayMode
        }
        if (trackDisplayDirectionalChevrons !== undefined) {
          migrated.displayDirectionalChevrons = trackDisplayDirectionalChevrons
        }

        return {
          ...rest,
          ...(height !== undefined && rest.heightPreConfig === undefined
            ? { heightPreConfig: height }
            : undefined),
          ...(Object.keys(migrated).length > 0 && {
            configOverrides: { ...rest.configOverrides, ...migrated },
          }),
        }
      })
      .volatile(() => ({
        rpcDataMap: observable.map<number, LoadedFeatureData>(),
        canvasDrawn: false,
        featureIdUnderMouse: null as string | null,
        subfeatureIdUnderMouse: null as string | null,
        mouseoverExtraInformation: undefined as string | undefined,
        contextMenuFeature: undefined as Feature | undefined,
        contextMenuInfo: undefined as
          | { item: FlatbushItem; displayedRegionIndex: number }
          | undefined,
        userFeatureDensityLimit: undefined as number | undefined,
        featureDensityPerPx: 0,
        heightBeforeExpand: undefined as number | undefined,
      }))
      .views(self => ({
        // Laid-out data derived from the raw per-region fetch results. Mobx
        // caches this — it only recomputes when any tracked input changes (raw
        // data, bpPerPx, label visibility). Every consumer (hit test, GPU
        // upload, React render) reads this getter and sees the same cached map
        // until an input moves.
        get laidOutDataMap(): Map<number, FeatureDataResult> {
          const view = getContainingView(self) as LGV
          if (!view.initialized || self.rpcDataMap.size === 0) {
            return new Map()
          }
          return computeLaidOutData(self.rpcDataMap, {
            bpPerPx: view.coarseBpPerPx,
            regionKeys: this.regionKeys,
            showLabels: this.showLabels,
            showDescriptions: this.effectiveShowDescriptions,
          })
        },

        get maxY() {
          let max = 0
          for (const data of this.laidOutDataMap.values()) {
            for (const item of data.flatbushItems) {
              if (item.bottomPx > max) {
                max = item.bottomPx
              }
            }
          }
          return max
        },

        get hasOverflow() {
          return this.maxY > self.height
        },

        get renderState() {
          const view = getContainingView(self) as LGV
          return {
            scrollY: self.scrollTop,
            canvasWidth: view.trackWidthPx,
            canvasHeight: self.height,
          }
        },

        get scalebarOverlapLeft() {
          const view = getContainingView(self) as {
            trackLabelsSetting?: string
          }
          if (view.trackLabelsSetting === 'overlapping') {
            const track = getContainingTrack(self)
            return measureText(getConf(track, 'name'), 12.8) + 100
          }
          return 0
        },

        get adapterConfigSnapshot() {
          return getConf(getContainingTrack(self), 'adapter') as Record<
            string,
            unknown
          >
        },

        get displayConfigSnapshot(): DisplayConfig {
          return {
            ...getConfSnapshot(self.configuration),
            ...(self.configOverrides as Omit<
              typeof self.configOverrides,
              symbol
            >),
          } as DisplayConfig
        },

        get DisplayMessageComponent() {
          return FeatureComponent
        },

        get showTooltipsEnabled() {
          return false
        },

        get showLegend() {
          return false
        },

        get maxHeight() {
          return self.getConfWithOverride<number>('maxHeight')
        },

        get autoHeight() {
          return self.getConfWithOverride<boolean>('autoHeight')
        },

        get showLabels() {
          return self.getConfWithOverride<boolean>('showLabels')
        },

        get showDescriptions() {
          return self.getConfWithOverride<boolean>('showDescriptions')
        },

        get showOutline() {
          return !!self.getConfWithOverride<string>('outline')
        },

        get effectiveShowDescriptions() {
          return (
            this.showDescriptions &&
            self.featureDensityPerPx < DESCRIPTION_DENSITY_THRESHOLD
          )
        },

        get selectedFeatureId() {
          if (isAlive(self)) {
            const { selection } = getSession(self)
            if (isFeature(selection)) {
              return selection.id()
            }
          }
          return undefined
        },

        get hoveredFeature() {
          const id = self.featureIdUnderMouse
          if (id) {
            for (const data of this.laidOutDataMap.values()) {
              for (const f of data.flatbushItems) {
                if (f.featureId === id) {
                  return f
                }
              }
            }
          }
          return null
        },

        get hoveredSubfeature() {
          const id = self.subfeatureIdUnderMouse
          if (id) {
            for (const data of this.laidOutDataMap.values()) {
              for (const s of data.subfeatureInfos) {
                if (s.featureId === id) {
                  return s
                }
              }
            }
          }
          return null
        },

        get maxFeatureDensity() {
          const view = getContainingView(self) as LGV
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return undefined
          }
          return (
            self.userFeatureDensityLimit ??
            self.getConfWithOverride<number>('maxFeatureScreenDensity')
          )
        },

        get colorByCDS() {
          const view = getContainingView(self) as LGV
          return view.colorByCDS
        },

        get sequenceAdapter() {
          const { assemblyManager } = getSession(self)
          const track = getContainingTrack(self)
          const assemblyNames = readConfObject(
            track.configuration,
            'assemblyNames',
          ) as string[]
          const assembly = assemblyManager.get(assemblyNames[0]!)
          return assembly
            ? getConf(assembly, ['sequence', 'adapter'])
            : undefined
        },

        get regionKeys() {
          const map = new Map<number, string>()
          for (const [num, region] of self.loadedRegions) {
            map.set(num, `${region.assemblyName}:${region.refName}`)
          }
          return map
        },

        getFeatureById(featureId: string): FlatbushItem | undefined {
          for (const data of this.laidOutDataMap.values()) {
            const found = data.flatbushItems.find(
              f => f.featureId === featureId,
            )
            if (found) {
              return found
            }
          }
          return undefined
        },

        searchFeatureByID(id: string) {
          const item = this.getFeatureById(id)
          if (!item) {
            return undefined
          }
          return [item.startBp, item.topPx, item.endBp, item.bottomPx] as const
        },

        get featureWidgetType() {
          return {
            type: 'BaseFeatureWidget',
            id: 'baseFeature',
          }
        },

        // Subclasses override to inject additional fields into the
        // `displayConfig` payload sent to the RenderFeatureData RPC (e.g.
        // effectiveGeneGlyphMode resolving 'auto').
        get displayConfigOverrides(): Record<string, unknown> {
          return {}
        },

        // Subclasses override to inject additional top-level args into the
        // RenderFeatureData RPC call (e.g. showOnlyGenes).
        get extraRpcArgs(): Record<string, unknown> {
          return {}
        },
      }))
      .views(self => ({
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .views(self => ({
        // The full payload sent to the RenderFeatureData RPC. Adding a
        // field here propagates both into the RPC call (via
        // fetchFeaturesForRegion) and into the SettingsInvalidate autorun
        // (which reads this getter), so refetch happens automatically when
        // any field changes — no separate cache key to maintain.
        get rpcProps() {
          return {
            adapterConfig: self.adapterConfigSnapshot,
            displayConfig: {
              ...self.displayConfigSnapshot,
              ...self.displayConfigOverrides,
            },
            maxFeatureDensity: self.maxFeatureDensity,
            colorByCDS: self.colorByCDS,
            sequenceAdapter: self.sequenceAdapter,
            ...self.extraRpcArgs,
          }
        },
      }))
      .actions(self => ({
        expandToFit() {
          self.heightBeforeExpand = self.height
          self.setHeight(Math.min(self.maxY, self.maxHeight))
        },

        collapseFromExpand() {
          if (self.heightBeforeExpand !== undefined) {
            self.setHeight(self.heightBeforeExpand)
            self.heightBeforeExpand = undefined
          }
        },

        setRpcData(
          displayedRegionIndex: number,
          data: FeatureDataResult,
          loadedBpPerPx: number,
        ) {
          self.rpcDataMap.set(displayedRegionIndex, { ...data, loadedBpPerPx })
        },

        setFeatureDensityPerPx(value: number) {
          self.featureDensityPerPx = value
        },

        clearDisplaySpecificData() {
          // Deliberately NOT clearing rpcDataMap — we keep stale data
          // visible through the refetch window (labels don't vanish and
          // reappear). fetchNeeded prunes regions that are no longer
          // visible, so this doesn't leak.
          self.setRegionTooLarge(false)
          self.setScrollTop(0)
        },

        pruneRpcDataMapToVisible(visibleDisplayedRegionIndices: Set<number>) {
          for (const key of self.rpcDataMap.keys()) {
            if (!visibleDisplayedRegionIndices.has(key)) {
              self.rpcDataMap.delete(key)
            }
          }
        },

        startGpuBackendLifecycle(backend: CanvasFeatureBackend) {
          self.installGpuDisplay<CanvasFeatureBackend>(backend, {
            upload: b => {
              const active: number[] = []
              for (const [displayedRegionIndex, data] of self.laidOutDataMap) {
                b.uploadRegion(displayedRegionIndex, data)
                active.push(displayedRegionIndex)
              }
              b.pruneRegions(active)
            },
            render: b => {
              b.renderBlocks(self.renderBlocks, self.renderState)
              return true
            },
          })
        },

        setFeatureDensityStatsLimit() {
          self.userFeatureDensityLimit = Math.ceil(self.maxFeatureDensity! * 3)
          self.setRegionTooLarge(false)
        },

        setFeatureIdUnderMouse(featureId: string | null) {
          self.featureIdUnderMouse = featureId
        },

        setSubfeatureIdUnderMouse(featureId: string | null) {
          self.subfeatureIdUnderMouse = featureId
        },

        clearHover() {
          self.featureIdUnderMouse = null
          self.subfeatureIdUnderMouse = null
          self.mouseoverExtraInformation = undefined
        },

        setMouseoverExtraInformation(info: string | undefined) {
          self.mouseoverExtraInformation = info
        },

        setContextMenuFeature(feature?: Feature) {
          self.contextMenuFeature = feature
        },

        setContextMenuInfo(info?: {
          item: FlatbushItem
          displayedRegionIndex: number
        }) {
          self.contextMenuInfo = info
          if (!info) {
            self.contextMenuFeature = undefined
          }
        },
      }))
      .actions(self => ({
        selectFeature(feature: Feature) {
          const session = getSession(self)
          session.setSelection(feature)
          if (isSessionModelWithWidgets(session)) {
            const { type, id } = self.featureWidgetType
            session.showWidget(
              session.addWidget(type, id, {
                featureData: feature.toJSON(),
                view: getContainingView(self),
                track: getContainingTrack(self),
              }),
            )
          }
        },

        clearSelection() {
          getSession(self).clearSelection()
        },

        setShowLabels(value: boolean) {
          self.setOverride('showLabels', value)
        },

        setShowDescriptions(value: boolean) {
          self.setOverride('showDescriptions', value)
        },

        setShowOutline(value: boolean) {
          self.setOverride('outline', value ? 'rgba(0,0,0,0.3)' : '')
        },

        showContextMenuForFeature(
          featureInfo: FlatbushItem,
          displayedRegionIndex: number,
        ) {
          self.setContextMenuInfo({ item: featureInfo, displayedRegionIndex })
        },
      }))
      .actions(self => ({
        async fetchFullFeature(
          featureId: string,
          displayedRegionIndex: number,
        ) {
          const region = self.loadedRegions.get(displayedRegionIndex)
          if (!region) {
            return undefined
          }
          return fetchCanvasFeatureDetails(
            getSession(self),
            getRpcSessionId(self),
            self.adapterConfigSnapshot,
            featureId,
            region,
          )
        },

        selectFeatureById(
          featureInfo: FlatbushItem,
          subfeatureInfo: SubfeatureInfo | undefined,
          displayedRegionIndex: number,
        ) {
          const region = self.loadedRegions.get(displayedRegionIndex)
          if (!region) {
            return
          }
          const featureIdToFetch = subfeatureInfo
            ? subfeatureInfo.parentFeatureId
            : featureInfo.featureId
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            const parentFeature = await fetchCanvasFeatureDetails(
              getSession(self),
              getRpcSessionId(self),
              self.adapterConfigSnapshot,
              featureIdToFetch,
              region,
            )
            if (parentFeature && isAlive(self)) {
              const target = subfeatureInfo
                ? (findSubfeatureById(
                    parentFeature,
                    subfeatureInfo.featureId,
                  ) ?? parentFeature)
                : parentFeature
              self.selectFeature(target)
            }
          })()
        },

        // Worker output positions and heights are genomic and config-driven
        // (no continuous bpPerPx dependence). The only `bpPerPx`-driven
        // worker decision that affects output is whether the amino-acid
        // overlay was fetched (gated by `shouldRenderPeptideBackground`).
        // Refetch only when crossing that discrete threshold — never on
        // continuous zoom drift.
        isCacheValid(displayedRegionIndex: number) {
          const regionData = self.rpcDataMap.get(displayedRegionIndex)
          if (regionData === undefined) {
            return true
          }
          const view = getContainingView(self) as LGV
          return (
            shouldRenderPeptideBackground(view.bpPerPx) ===
            shouldRenderPeptideBackground(regionData.loadedBpPerPx)
          )
        },
      }))
      .actions(self => ({
        selectFullFeature(featureId: string, displayedRegionIndex: number) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            const feature = await self.fetchFullFeature(
              featureId,
              displayedRegionIndex,
            )
            if (feature && isAlive(self)) {
              self.selectFeature(feature)
            }
          })()
        },
      }))
      .actions(self => {
        interface FetchResult {
          displayedRegionIndex: number
          data: FeatureDataResult
          region: Region
          bpPerPx: number
        }

        async function fetchFeaturesForRegion(
          region: Region,
          displayedRegionIndex: number,
          bpPerPx: number,
          stopToken: StopToken,
        ): Promise<FetchResult | 'regionTooLarge'> {
          const sessionId = getRpcSessionId(self)
          const result = await getSession(self).rpcManager.call(
            sessionId,
            'RenderFeatureData',
            {
              sessionId,
              ...self.rpcProps,
              region,
              bpPerPx,
              stopToken,
              statusCallback: (msg: string) => {
                if (isAlive(self)) {
                  self.setStatusMessage(msg)
                }
              },
            },
          )
          if ('regionTooLarge' in result) {
            return 'regionTooLarge'
          }
          return { displayedRegionIndex, data: result, region, bpPerPx }
        }

        function applyFetchResults(results: FetchResult[]) {
          let totalFeatures = 0
          let totalSpanPx = 0
          for (const r of results) {
            self.setRpcData(r.displayedRegionIndex, r.data, r.bpPerPx)
            totalFeatures += r.data.featureCount
            totalSpanPx += (r.region.end - r.region.start) / r.bpPerPx
          }
          self.setFeatureDensityPerPx(
            totalSpanPx > 0 ? totalFeatures / totalSpanPx : 0,
          )
        }

        return {
          async reload() {
            const view = getContainingView(self) as LinearGenomeViewModel
            if (!view.initialized) {
              return
            }
            self.clearAllRpcData()
            self.fetchNeeded(view.bufferedVisibleRegions)
          },

          fetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            const view = getContainingView(self) as LGV
            const bpPerPx = view.bpPerPx
            // Drop cached regions that are no longer visible. Keeps stale data
            // for regions still on screen (so labels stay up during the
            // refetch window) without letting rpcDataMap grow unboundedly as
            // the user pans.
            self.pruneRpcDataMapToVisible(
              new Set(
                view.bufferedVisibleRegions.map(b => b.displayedRegionIndex),
              ),
            )
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            self.fetchRegions(needed, async (ctx: FetchContext) => {
              const promises = needed.map(({ region, displayedRegionIndex }) =>
                fetchFeaturesForRegion(
                  region,
                  displayedRegionIndex,
                  bpPerPx,
                  ctx.stopToken,
                ),
              )
              const results = await Promise.all(promises)
              if (ctx.isStale()) {
                return
              }
              if (results.includes('regionTooLarge')) {
                self.setRegionTooLarge(true, 'Too many features')
                return
              }
              applyFetchResults(
                results.filter((r): r is FetchResult => r !== 'regionTooLarge'),
              )
            })
          },
        }
      })
      .actions(self => {
        const superAfterAttach = self.afterAttach
        return {
          afterAttach() {
            superAfterAttach()

            // Auto-height: snap height to fit the laid-out content. maxY
            // derives from laidOutDataMap, which derives from raw fetch data +
            // bpPerPx + label visibility — so zoom and label toggles both
            // flow through here without any extra plumbing.
            addDisposer(
              self,
              autorun(
                () => {
                  if (!self.autoHeight) {
                    return
                  }
                  const target = Math.min(
                    Math.max(self.maxY, 50),
                    self.maxHeight,
                  )
                  self.setHeight(target)
                },
                { name: 'CanvasAutoHeight' },
              ),
            )
          },
        }
      })
      .views(self => ({
        // Extension point for subclasses to add checkbox/radio items to the
        // "Show..." submenu without rebuilding trackMenuItems from scratch.
        showSubmenuMenuItems() {
          return [
            {
              label: 'Show labels',
              type: 'checkbox' as const,
              checked: self.showLabels,
              onClick: () => {
                self.setShowLabels(!self.showLabels)
              },
            },
            {
              label: 'Show descriptions',
              type: 'checkbox' as const,
              checked: self.showDescriptions,
              onClick: () => {
                self.setShowDescriptions(!self.showDescriptions)
              },
            },
            {
              label: 'Show outline',
              type: 'checkbox' as const,
              checked: self.showOutline,
              onClick: () => {
                self.setShowOutline(!self.showOutline)
              },
            },
          ]
        },
      }))
      .views(self => ({
        contextMenuItems() {
          const info = self.contextMenuInfo
          if (!info) {
            return []
          }
          const {
            item: { featureId, startBp, endBp },
            displayedRegionIndex,
          } = info
          const region = self.loadedRegions.get(displayedRegionIndex)
          return [
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                self.selectFullFeature(featureId, displayedRegionIndex)
              },
            },
            {
              label: 'Zoom to feature',
              icon: CenterFocusStrongIcon,
              onClick: () => {
                if (region) {
                  const view = getContainingView(self) as LGV
                  view.navTo({
                    refName: region.refName,
                    start: startBp,
                    end: endBp,
                  })
                }
              },
            },
            {
              label: 'Copy info to clipboard',
              icon: ContentCopyIcon,
              onClick: () => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                ;(async () => {
                  if (!region) {
                    return
                  }
                  const session = getSession(self)
                  const fullFeature = await fetchCanvasFeatureDetails(
                    session,
                    getRpcSessionId(self),
                    self.adapterConfigSnapshot,
                    featureId,
                    region,
                  )
                  if (!fullFeature) {
                    return
                  }
                  try {
                    const { uniqueId: _, ...rest } = fullFeature.toJSON()
                    const { default: copy } = await import('copy-to-clipboard')
                    await copy(JSON.stringify(rest, null, 4))
                    session.notify('Copied to clipboard', 'success')
                  } catch (e) {
                    console.error(e)
                    session.notifyError(`${e}`, e)
                  }
                })()
              },
            },
          ]
        },

        trackMenuItems() {
          return [
            {
              label: 'Show...',
              icon: VisibilityIcon,
              subMenu: self.showSubmenuMenuItems(),
            },
          ]
        },
      }))
  )
}
