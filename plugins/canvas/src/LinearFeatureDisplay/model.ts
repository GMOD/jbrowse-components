import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
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
import { addDisposer, flow, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun, reaction, untracked } from 'mobx'

import {
  getTranscripts,
  hasIntrons,
} from './components/CollapseIntronsDialog/util.ts'
import { computeAndAssignLayout } from './layout.ts'

const CollapseIntronsDialog = lazy(
  () => import('./components/CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
  MultiRegionRegion as Region,
} from '@jbrowse/plugin-linear-genome-view'

export interface ContextMenuFeatureInfo {
  featureId: string
  type: string
  startBp: number
  endBp: number
  regionNumber: number
}

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

const FeatureComponent = lazy(() => import('./components/FeatureComponent.tsx'))

const DESCRIPTION_DENSITY_THRESHOLD = 0.2

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearFeatureDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        type: types.literal('LinearFeatureDisplay'),
        configuration: ConfigurationReference(configSchema),
        trackShowLabels: types.maybe(types.boolean),
        trackShowDescriptions: types.maybe(types.boolean),
        trackSubfeatureLabels: types.maybe(types.string),
        trackGeneGlyphMode: types.maybe(types.string),
        trackDisplayMode: types.maybe(types.string),
        showOnlyGenes: false,
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }

      // Strip properties from old BaseLinearDisplay/FeatureDensityMixin snapshots
      const {
        blockState,
        showLegend,
        showTooltips,
        userBpPerPxLimit,
        userByteSizeLimit,
        ...cleaned
      } = snap
      snap = cleaned

      // Rewrite "height" from older snapshots to "heightPreConfig"
      if (snap.height !== undefined && snap.heightPreConfig === undefined) {
        const { height, ...rest } = snap
        snap = { ...rest, heightPreConfig: height }
      }

      return snap
    })
    .volatile(() => ({
      rpcDataMap: new Map<number, FeatureDataResult>(),
      layoutBpPerPxMap: new Map<number, number>(),
      maxY: 0,
      featureIdUnderMouse: null as string | null,
      mouseoverExtraInformation: undefined as string | undefined,
      contextMenuInfo: undefined as ContextMenuFeatureInfo | undefined,
      userFeatureCountLimit: undefined as number | undefined,
      featureDensityPerPx: 0,
    }))
    .views(self => ({
      get scalebarOverlapLeft() {
        const view = getContainingView(self) as { trackLabelsSetting?: string }
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

      get DisplayMessageComponent() {
        return FeatureComponent
      },

      get showTooltipsEnabled() {
        return false
      },

      get showLegend() {
        return false
      },

      renderProps() {
        return { notReady: true }
      },

      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },

      get maxHeight(): number {
        return getConf(self, 'maxHeight') ?? 1200
      },

      get autoHeight(): boolean {
        return getConf(self, 'autoHeight') ?? false
      },

      get showLabels(): boolean {
        return self.trackShowLabels ?? true
      },

      get showDescriptions(): boolean {
        return self.trackShowDescriptions ?? true
      },

      get effectiveShowDescriptions(): boolean {
        if (self.trackShowDescriptions === false) {
          return false
        }
        return self.featureDensityPerPx < DESCRIPTION_DENSITY_THRESHOLD
      },

      get subfeatureLabels(): string {
        return self.trackSubfeatureLabels ?? 'none'
      },

      get displayMode(): string {
        return self.trackDisplayMode ?? 'normal'
      },

      get geneGlyphMode(): string {
        return self.trackGeneGlyphMode ?? 'auto'
      },

      get effectiveGeneGlyphMode(): string {
        const mode = self.trackGeneGlyphMode ?? 'auto'
        if (mode === 'auto') {
          const view = getContainingView(self) as LGV
          return view.bpPerPx > 100 ? 'longest' : 'all'
        }
        return mode
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

      get maxFeatureCount() {
        return self.userFeatureCountLimit ?? 5000
      },

      get colorByCDS() {
        const view = getContainingView(self) as LGV
        return (view as unknown as { colorByCDS?: boolean }).colorByCDS ?? false
      },

      get sequenceAdapter() {
        const { assemblyManager } = getSession(self)
        const track = getContainingTrack(self)
        const assemblyNames = readConfObject(
          track.configuration,
          'assemblyNames',
        ) as string[]
        const assembly = assemblyManager.get(assemblyNames[0]!)
        return assembly ? getConf(assembly, ['sequence', 'adapter']) : undefined
      },

      get needsLayoutRefresh() {
        try {
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
        } catch {
          return false
        }
      },

      getFeatureById(featureId: string): FlatbushItem | undefined {
        for (const data of self.rpcDataMap.values()) {
          const found = data.flatbushItems.find(f => f.featureId === featureId)
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
    }))
    .actions(self => ({
      setRpcDataMap(dataMap: Map<number, FeatureDataResult>) {
        self.rpcDataMap = dataMap
        let globalMaxY = 0
        for (const d of dataMap.values()) {
          globalMaxY = Math.max(globalMaxY, d.maxY)
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
      },

      setFeatureDensityStatsLimit() {
        self.userFeatureCountLimit = Math.ceil(self.maxFeatureCount * 3)
        self.setRegionTooLarge(false)
      },

      setFeatureIdUnderMouse(featureId: string | null) {
        self.featureIdUnderMouse = featureId
      },

      setMouseoverExtraInformation(info: string | undefined) {
        self.mouseoverExtraInformation = info
      },

      setContextMenuInfo(info?: ContextMenuFeatureInfo) {
        self.contextMenuInfo = info
      },
    }))
    .actions(self => ({
      selectFeature(feature: Feature) {
        const session = getSession(self)
        session.setSelection(feature)
        if (isSessionModelWithWidgets(session)) {
          const track = getContainingTrack(self)
          const view = getContainingView(self)
          const { type, id } = self.featureWidgetType
          session.showWidget(
            session.addWidget(type, id, {
              featureData: feature.toJSON(),
              view,
              track,
            }),
          )
        }
      },

      clearSelection() {
        getSession(self).clearSelection()
      },

      setShowLabels(value: boolean) {
        self.trackShowLabels = value
      },

      setShowDescriptions(value: boolean) {
        self.trackShowDescriptions = value
      },

      setSubfeatureLabels(value: string) {
        self.trackSubfeatureLabels = value
      },

      setGeneGlyphMode(value: string) {
        self.trackGeneGlyphMode = value
      },

      setDisplayMode(value: string) {
        self.trackDisplayMode = value
      },

      setShowOnlyGenes(value: boolean) {
        self.showOnlyGenes = value
      },

      showContextMenuForFeature(
        featureInfo: FlatbushItem,
        regionNumber: number,
      ) {
        self.setContextMenuInfo({
          featureId: featureInfo.featureId,
          type: featureInfo.type,
          startBp: featureInfo.startBp,
          endBp: featureInfo.endBp,
          regionNumber,
        })
      },
    }))
    .actions(self => ({
      fetchFullFeature: flow(function* (
        featureId: string,
        regionNumber: number,
      ) {
        const session = getSession(self)
        const { rpcManager } = session
        const adapterConfig = self.adapterConfigSnapshot

        const region = self.loadedRegions.get(regionNumber)
        if (!region) {
          return undefined
        }

        try {
          const result = yield rpcManager.call(
            getRpcSessionId(self),
            'GetCanvasFeatureDetails',
            {
              adapterConfig,
              featureId,
              region,
            },
          )

          if (result.feature && isAlive(self)) {
            return new SimpleFeature(result.feature)
          }
        } catch (e) {
          console.error('Failed to fetch feature details:', e)
          session.notifyError(`${e}`, e)
        }
        return undefined
      }),
    }))
    .actions(self => ({
      selectFullFeature: flow(function* (
        featureId: string,
        regionNumber: number,
      ) {
        const feature: Feature | undefined = yield self.fetchFullFeature(
          featureId,
          regionNumber,
        )
        if (feature) {
          self.selectFeature(feature)
        }
      }),

      selectFeatureById: flow(function* (
        featureInfo: FlatbushItem,
        subfeatureInfo: SubfeatureInfo | undefined,
        regionNumber: number,
      ) {
        const featureIdToFetch = subfeatureInfo
          ? subfeatureInfo.parentFeatureId
          : featureInfo.featureId

        const parentFeature: Feature | undefined = yield self.fetchFullFeature(
          featureIdToFetch,
          regionNumber,
        )

        if (parentFeature) {
          if (subfeatureInfo) {
            const subfeature = findSubfeatureById(
              parentFeature,
              subfeatureInfo.featureId,
            )
            if (subfeature) {
              self.selectFeature(subfeature)
            } else {
              self.selectFeature(parentFeature)
            }
          } else {
            self.selectFeature(parentFeature)
          }
        }
      }),
    }))
    .actions(self => {
      return {
        // Soft reset: clears tracking state (loadedRegions,
        // layoutBpPerPxMap, error, stopToken) and bumps fetchGeneration to
        // invalidate in-flight fetches, but intentionally preserves
        // rpcDataMap so the previous frame's rendered data stays visible
        // while the new fetch is in progress, avoiding a flash of empty
        // content. Compare with reload()/clearAllRpcData() which is a
        // "hard reset" that also wipes rpcDataMap.
        softReset() {
          if (self.renderingStopToken) {
            stopStopToken(self.renderingStopToken)
            self.renderingStopToken = undefined
          }
          self.isLoading = false
          self.error = undefined
          self.loadedRegions = new Map()
          self.layoutBpPerPxMap = new Map()
          self.setRegionTooLarge(false)
          self.fetchGeneration++
        },
      }
    })
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
        stopToken: string,
      ): Promise<FetchResult | 'regionTooLarge'> {
        const session = getSession(self)
        const { rpcManager } = session
        const adapterConfig = self.adapterConfigSnapshot

        const result = await rpcManager.call(
          getRpcSessionId(self),
          'RenderFeatureData',
          {
            adapterConfig,
            displayConfig: {
              showLabels: self.showLabels,
              showDescriptions: self.showDescriptions,
              subfeatureLabels: self.subfeatureLabels,
              geneGlyphMode: self.effectiveGeneGlyphMode,
              displayMode: self.displayMode,
            },
            region,
            bpPerPx,
            maxFeatureCount: self.maxFeatureCount,
            colorByCDS: self.colorByCDS,
            sequenceAdapter: self.sequenceAdapter,
            showOnlyGenes: self.showOnlyGenes,
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
        return { regionNumber, data: result, region, bpPerPx }
      }

      function applyFetchResults(
        results: (FetchResult | undefined)[],
        bpPerPx: number,
      ) {
        const dataMap = new Map(self.rpcDataMap)
        const regionKeys = new Map<number, string>()
        const newRegionNumbers = new Set<number>()
        for (const [num, region] of self.loadedRegions) {
          regionKeys.set(num, `${region.assemblyName}:${region.refName}`)
        }
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
        // Compute density BEFORE layout so effectiveShowDescriptions is
        // accurate for the first layout pass (avoids a re-layout flash)
        let totalFeatures = 0
        let totalSpanPx = 0
        for (const r of results) {
          if (r) {
            self.setLoadedRegionForRegion(r.regionNumber, r.region)
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
          self.effectiveShowDescriptions,
        )
        self.setRpcDataMap(dataMap)
      }

      function fetchAllRegions() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const regions = view.staticRegions.map(vr => ({
          region: vr as Region,
          regionNumber: vr.regionNumber,
        }))
        self.onFetchNeeded(regions)
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

        onFetchNeeded(needed: { region: Region; regionNumber: number }[]) {
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
    .actions(self => {
      const superAfterAttach = self.afterAttach
      return {
        afterAttach() {
          superAfterAttach()
          // adapterConfigSnapshot is only accessed inside a conditional branch
          // (when new regions need fetching), so MobX drops it from the
          // dependency set when no fetch is needed and suspends the computed.
          // This no-op autorun keeps it observed so idMaker isn't re-called on
          // every fetch.
          addDisposer(
            self,
            autorun(() => {
              void self.adapterConfigSnapshot
            }),
          )

          // Reaction: re-fetch when settings that require new RPC data change
          addDisposer(
            self,
            reaction(
              () => ({
                showLabels: self.showLabels,
                showDescriptions: self.showDescriptions,
                subfeatureLabels: self.subfeatureLabels,
                colorByCDS: self.colorByCDS,
                geneGlyphMode: self.effectiveGeneGlyphMode,
                showOnlyGenes: self.showOnlyGenes,
                displayMode: self.displayMode,
              }),
              () => {
                if (self.loadedRegions.size > 0 || self.regionTooLarge) {
                  self.refetchForCurrentView()
                }
              },
              {
                name: 'SettingsRefetch',
                delay: 100,
                fireImmediately: false,
                equals: (a, b) =>
                  a.showLabels === b.showLabels &&
                  a.showDescriptions === b.showDescriptions &&
                  a.subfeatureLabels === b.subfeatureLabels &&
                  a.colorByCDS === b.colorByCDS &&
                  a.geneGlyphMode === b.geneGlyphMode &&
                  a.showOnlyGenes === b.showOnlyGenes &&
                  a.displayMode === b.displayMode,
              },
            ),
          )
        },
      }
    })

    .views(self => ({
      get isGeneLike() {
        const type = (self.contextMenuInfo?.type ?? '').toLowerCase()
        return (
          type.includes('gene') ||
          type.includes('rna') ||
          type.includes('transcript')
        )
      },
    }))
    .views(self => ({
      contextMenuItems() {
        const info = self.contextMenuInfo
        if (!info) {
          return []
        }
        const { featureId, startBp, endBp, regionNumber } = info
        const region = self.loadedRegions.get(regionNumber)
        return [
          {
            label: 'Open feature details',
            icon: MenuOpenIcon,
            onClick: () => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
                const fullFeature = await self.fetchFullFeature(
                  featureId,
                  regionNumber,
                )
                if (!fullFeature) {
                  return
                }
                const session = getSession(self)
                const { uniqueId: _, ...rest } = fullFeature.toJSON()
                const { default: copy } = await import('copy-to-clipboard')
                copy(JSON.stringify(rest, null, 4))
                session.notify('Copied to clipboard', 'success')
              })()
            },
          },
          ...(self.isGeneLike
            ? [
                {
                  label: 'Collapse introns',
                  icon: CloseFullscreenIcon,
                  onClick: () => {
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    ;(async () => {
                      const fullFeature = await self.fetchFullFeature(
                        featureId,
                        regionNumber,
                      )
                      if (!fullFeature) {
                        return
                      }
                      const session = getSession(self)
                      const transcripts = getTranscripts(fullFeature)
                      if (!hasIntrons(transcripts)) {
                        session.notify(
                          'No introns found in this feature',
                          'info',
                        )
                        return
                      }
                      const view = getContainingView(self) as LGV
                      const { assemblyManager } = session
                      const assembly = assemblyManager.get(
                        view.assemblyNames[0]!,
                      )
                      if (assembly) {
                        session.queueDialog(handleClose => [
                          CollapseIntronsDialog,
                          { view, transcripts, handleClose, assembly },
                        ])
                      }
                    })()
                  },
                },
              ]
            : []),
        ]
      },

      trackMenuItems() {
        return [
          {
            label: 'Show...',
            icon: VisibilityIcon,
            subMenu: [
              {
                label: 'Show labels',
                type: 'checkbox',
                checked: self.showLabels,
                onClick: () => {
                  self.setShowLabels(!self.showLabels)
                },
              },
              {
                label: 'Show descriptions',
                type: 'checkbox',
                checked: self.showDescriptions,
                onClick: () => {
                  self.setShowDescriptions(!self.showDescriptions)
                },
              },
              {
                label: 'Show only genes',
                type: 'checkbox',
                checked: self.showOnlyGenes,
                onClick: () => {
                  self.setShowOnlyGenes(!self.showOnlyGenes)
                },
              },
            ],
          },
          {
            label: 'Transcript labels',
            subMenu: (
              [
                { value: 'none', label: 'None' },
                { value: 'overlay', label: 'Overlay' },
                { value: 'below', label: 'Below' },
              ] as const
            ).map(({ value, label }) => ({
              label,
              type: 'radio' as const,
              checked: self.subfeatureLabels === value,
              onClick: () => {
                self.setSubfeatureLabels(value)
              },
            })),
          },
          {
            label: 'Gene glyph',
            subMenu: (
              [
                { value: 'auto', label: 'Auto' },
                { value: 'all', label: 'All transcripts' },
                { value: 'longest', label: 'Longest transcript' },
                { value: 'longestCoding', label: 'Longest coding transcript' },
              ] as const
            ).map(({ value, label }) => ({
              label,
              type: 'radio' as const,
              checked: self.geneGlyphMode === value,
              onClick: () => {
                self.setGeneGlyphMode(value)
              },
            })),
          },
          {
            label: 'Display mode',
            subMenu: (
              [
                { value: 'normal', label: 'Normal' },
                { value: 'compact', label: 'Compact' },
              ] as const
            ).map(({ value, label }) => ({
              label,
              type: 'radio' as const,
              checked: self.displayMode === value,
              onClick: () => {
                self.setDisplayMode(value)
              },
            })),
          },
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      const {
        trackShowLabels,
        trackShowDescriptions,
        trackSubfeatureLabels,
        trackGeneGlyphMode,
        trackDisplayMode,
        showOnlyGenes,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(trackShowLabels !== undefined && { trackShowLabels }),
        ...(trackShowDescriptions !== undefined && { trackShowDescriptions }),
        ...(trackSubfeatureLabels !== undefined && { trackSubfeatureLabels }),
        ...(trackGeneGlyphMode !== undefined && { trackGeneGlyphMode }),
        ...(trackDisplayMode !== undefined && { trackDisplayMode }),
        ...(showOnlyGenes && { showOnlyGenes }),
      } as typeof snap
    })
}

export type LinearFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearFeatureDisplayModel = Instance<LinearFeatureDisplayStateModel>
