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
import { stopStopToken } from '@jbrowse/core/util/stopToken'
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
import { autorun, untracked } from 'mobx'

import { computeAndAssignLayout, relayoutAllRegions } from './layout.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { CanvasFeatureBackend } from './components/canvasFeatureBackendTypes.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
  MultiRegionRegion as Region,
  MultiRegionRegionWithNumber as RegionWithNumber,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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

export type { MultiRegionRegion as Region } from '@jbrowse/plugin-linear-genome-view'

export async function fetchCanvasFeatureDetails(
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
        rpcDataMap: new Map<number, FeatureDataResult>(),
        layoutBpPerPxMap: new Map<number, number>(),
        maxY: 0,
        canvasDrawn: false,
        featureIdUnderMouse: null as string | null,
        subfeatureIdUnderMouse: null as string | null,
        mouseoverExtraInformation: undefined as string | undefined,
        contextMenuInfo: undefined as
          | { item: FlatbushItem; regionNumber: number }
          | undefined,
        userFeatureDensityLimit: undefined as number | undefined,
        featureDensityPerPx: 0,
        heightBeforeExpand: undefined as number | undefined,
      }))
      .views(self => ({
        get hasOverflow() {
          return self.maxY > self.height
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

        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as any, opts)
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
            for (const data of self.rpcDataMap.values()) {
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
            for (const data of self.rpcDataMap.values()) {
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

        get needsLayoutRefresh() {
          const view = getContainingView(self) as LGV
          if (!view.initialized || self.layoutBpPerPxMap.size === 0) {
            return false
          }
          for (const layoutBpPerPx of self.layoutBpPerPxMap.values()) {
            const ratio = view.bpPerPx / layoutBpPerPx
            if (ratio > 2 || ratio < 0.5) {
              return true
            }
          }
          return false
        },

        getFeatureById(featureId: string): FlatbushItem | undefined {
          for (const data of self.rpcDataMap.values()) {
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
        // The full payload sent to the RenderFeatureData RPC. Adding a
        // field here propagates both into the RPC call (via
        // fetchFeaturesForRegion) and into the SettingsInvalidate autorun
        // (which reads this getter), so refetch happens automatically when
        // any field changes — no separate cache key to maintain. Canvas's
        // worker does layout on the worker side, so all rendering-affecting
        // settings live in rpcProps; there is no separate gpuProps.
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
        setCanvasDrawn(value: boolean) {
          self.canvasDrawn = value
        },

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

        setRpcDataMap(dataMap: Map<number, FeatureDataResult>) {
          self.rpcDataMap = dataMap
          let globalMaxY = 0
          for (const d of dataMap.values()) {
            for (const item of d.flatbushItems) {
              if (item.bottomPx > globalMaxY) {
                globalMaxY = item.bottomPx
              }
            }
          }
          self.maxY = globalMaxY
          if (self.autoHeight) {
            self.setHeight(Math.min(Math.max(globalMaxY, 50), self.maxHeight))
          }
        },

        setFeatureDensityPerPx(value: number) {
          self.featureDensityPerPx = value
        },

        setLayoutBpPerPxForRegion(regionNumber: number, bpPerPx: number) {
          const next = new Map(self.layoutBpPerPxMap)
          next.set(regionNumber, bpPerPx)
          self.layoutBpPerPxMap = next
        },

        clearDisplaySpecificData() {
          self.rpcDataMap = new Map()
          self.layoutBpPerPxMap = new Map()
          self.setRegionTooLarge(false)
          self.setScrollTop(0)
        },

        startGpuBackendLifecycle(backend: CanvasFeatureBackend) {
          self.startMultiRegionGpuLifecycle<
            CanvasFeatureBackend,
            { scrollY: number; canvasWidth: number; canvasHeight: number }
          >({
            backend,
            uploads: [
              {
                getData: () => self.rpcDataMap,
                upload: (b, regionNumber, data: FeatureDataResult) => {
                  b.uploadRegion(regionNumber, data)
                },
                prune: (b, activeRegionNumbers) => {
                  b.pruneRegions(activeRegionNumbers)
                },
              },
            ],
            renderBlocks: () => self.renderBlocks,
            renderState: () => self.renderState,
            render: (b, blocks, state) => {
              b.renderBlocks(blocks, state)
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

        setContextMenuInfo(info?: {
          item: FlatbushItem
          regionNumber: number
        }) {
          self.contextMenuInfo = info
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

        showContextMenuForFeature(
          featureInfo: FlatbushItem,
          regionNumber: number,
        ) {
          self.setContextMenuInfo({ item: featureInfo, regionNumber })
        },
      }))
      .actions(self => ({
        selectFullFeature(featureId: string, regionNumber: number) {
          const region = self.loadedRegions.get(regionNumber)
          if (!region) {
            return
          }
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            const feature = await fetchCanvasFeatureDetails(
              getSession(self),
              getRpcSessionId(self),
              self.adapterConfigSnapshot,
              featureId,
              region,
            )
            if (feature && isAlive(self)) {
              self.selectFeature(feature)
            }
          })()
        },

        selectFeatureById(
          featureInfo: FlatbushItem,
          subfeatureInfo: SubfeatureInfo | undefined,
          regionNumber: number,
        ) {
          const region = self.loadedRegions.get(regionNumber)
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

        softReset() {
          if (self.renderingStopToken) {
            stopStopToken(self.renderingStopToken)
            self.renderingStopToken = undefined
          }
          self.error = undefined
          self.loadedRegions = new Map()
          self.layoutBpPerPxMap = new Map()
          self.setRegionTooLarge(false)
          self.fetchGeneration++
        },
      }))
      .actions(self => {
        interface FetchResult {
          regionNumber: number
          data: FeatureDataResult
          region: Region
          bpPerPx: number
        }

        async function fetchFeaturesForRegion(
          region: Region,
          regionNumber: number,
          bpPerPx: number,
          stopToken: StopToken,
        ): Promise<FetchResult | 'regionTooLarge'> {
          const session = getSession(self)
          const { rpcManager } = session

          const sessionId = getRpcSessionId(self)
          const result = await rpcManager.call(sessionId, 'RenderFeatureData', {
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
          })

          if ('regionTooLarge' in result) {
            return 'regionTooLarge'
          }
          return { regionNumber, data: result, region, bpPerPx }
        }

        function applyFetchResults(
          results: (FetchResult | undefined)[],
          bpPerPx: number,
        ) {
          const dataMap = new Map(self.rpcDataMap)
          const regionKeys = new Map(self.regionKeys)
          const newRegionNumbers = new Set<number>()
          for (const r of results) {
            if (r) {
              dataMap.set(r.regionNumber, r.data)
              newRegionNumbers.add(r.regionNumber)
              regionKeys.set(
                r.regionNumber,
                `${r.region.assemblyName}:${r.region.refName}`,
              )
            }
          }
          let totalFeatures = 0
          let totalSpanPx = 0
          for (const r of results) {
            if (r) {
              self.setLayoutBpPerPxForRegion(r.regionNumber, r.bpPerPx)
              totalFeatures += r.data.featureCount
              totalSpanPx += (r.region.end - r.region.start) / r.bpPerPx
            }
          }
          self.setFeatureDensityPerPx(
            totalSpanPx > 0 ? totalFeatures / totalSpanPx : 0,
          )

          computeAndAssignLayout(
            dataMap,
            bpPerPx,
            regionKeys,
            newRegionNumbers,
            self.showLabels,
            self.effectiveShowDescriptions,
          )
          self.setRpcDataMap(dataMap)
        }

        function fetchAllRegions() {
          const view = getContainingView(self) as LinearGenomeViewModel
          self.onFetchNeeded(view.bufferedVisibleRegions)
        }
        return {
          refetchForCurrentView() {
            const view = getContainingView(self) as LinearGenomeViewModel
            if (!view.initialized) {
              return
            }
            self.softReset()

            fetchAllRegions()
          },

          async reload() {
            const view = getContainingView(self) as LinearGenomeViewModel
            if (!view.initialized) {
              return
            }
            self.clearAllRpcData()

            fetchAllRegions()
          },

          beforeFetchCheck() {
            if (untracked(() => self.needsLayoutRefresh)) {
              self.softReset()
            }
          },

          getByteEstimateConfig() {
            return null
          },

          onFetchNeeded(needed: RegionWithNumber[]) {
            const view = getContainingView(self) as LGV
            const bpPerPx = view.bpPerPx
            self.withFetchLifecycle(needed, async (ctx: FetchContext) => {
              const promises = needed.map(({ region, regionNumber }) =>
                fetchFeaturesForRegion(
                  region,
                  regionNumber,
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
                bpPerPx,
              )
            })
          },
        }
      })
      .actions(self => ({
        relayoutForCurrentZoom(
          showLabels = self.showLabels,
          effectiveShowDescriptions = self.effectiveShowDescriptions,
        ) {
          const view = getContainingView(self) as LGV
          if (!view.initialized || self.rpcDataMap.size === 0) {
            return
          }
          const dataMap = new Map<number, FeatureDataResult>()
          for (const [k, v] of self.rpcDataMap) {
            dataMap.set(k, { ...v })
          }
          relayoutAllRegions(
            dataMap,
            view.bpPerPx,
            self.regionKeys,
            showLabels,
            effectiveShowDescriptions,
          )
          self.setRpcDataMap(dataMap)
        },
      }))
      .actions(self => {
        const superAfterAttach = self.afterAttach
        return {
          afterAttach() {
            superAfterAttach()

            // Relayout on zoom / label-visibility change. Reads
            // bpPerPx, showLabels, effectiveShowDescriptions as
            // triggers (effectiveShowDescriptions transitively tracks
            // showDescriptions + featureDensityPerPx). The rpcDataMap
            // read is untracked — we don't want the relayout's own
            // setRpcDataMap call to re-fire this autorun, and we don't
            // want initial data arrival to trigger a spurious relayout
            // (the fetch handler already lays out fresh data).
            addDisposer(
              self,
              autorun(
                () => {
                  const view = getContainingView(self) as LGV
                  if (!view.initialized) {
                    return
                  }
                  void view.bpPerPx
                  const showLabels = self.showLabels
                  const effectiveShowDescriptions =
                    self.effectiveShowDescriptions
                  untracked(() => {
                    if (self.rpcDataMap.size > 0) {
                      self.relayoutForCurrentZoom(
                        showLabels,
                        effectiveShowDescriptions,
                      )
                    }
                  })
                },
                {
                  name: 'RelayoutOnZoomOrLabelChange',
                  delay: 50,
                },
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
            regionNumber,
          } = info
          const region = self.loadedRegions.get(regionNumber)
          return [
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                self.selectFullFeature(featureId, regionNumber)
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
                    copy(JSON.stringify(rest, null, 4))
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
