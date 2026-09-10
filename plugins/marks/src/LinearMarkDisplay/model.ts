import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import {
  getDialogHost,
  getSession,
  openFeatureWidget,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { createStopTokenRotation } from '@jbrowse/core/util/createStopTokenRotation'
import Flatbush from '@jbrowse/core/util/flatbush'
import {
  activeJexlFilters,
  configuredJexlFilters,
  jexlFilterNarrowing,
} from '@jbrowse/core/util/jexlFilters'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import LegendMixin, {
  legendCheckboxItem,
} from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import { skippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { cast, types } from '@jbrowse/mobx-state-tree'
import {
  WiggleScoreConfigMixin,
  makePointSizeSubMenu,
} from '@jbrowse/plugin-wiggle'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances } from '@jbrowse/render-core/marks'
import {
  axisPlotBox,
  makeCrossHatchItem,
  makeScoreSubMenu,
  resolveRenderState,
  visibleStatsDomain,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { sameMarkHit } from './findMarkHit.ts'
import { buildMarkLegend, markColorScales } from './legend.ts'
import { SHAPE_LANES, buildMarkList, markDrawsAt } from './markList.ts'

import type { MarkDisplayContextMenuInfo } from './components/markDisplayTypes.ts'
import type {
  LinearMarkDisplayConfig,
  LinearMarkDisplayConfigModel,
  MarkConfig,
  MarkShapeName,
  MarkTransformStepConfig,
} from './configSchema.ts'
import type { MarkHitInfo } from './findMarkHit.ts'
import type {
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
} from './markList.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AggregateOp,
  ColorEncoding,
  EncodedFeaturesResult,
  GlyphEncoding,
  GlyphName,
  LayerRequest,
  MarkEncoding,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { Region } from '@jbrowse/core/util/types/data'
import type { SkippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { ValueScale, VisibleEntry } from '@jbrowse/wiggle-core'

export type MarkRenderingBackend = PerRegionRenderingBackend<
  MarkRegionData,
  MarkRenderState
>

const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))

// The worker's layers as the display stores them: the Flatbush wrapped once
// at the commit.
function storedRegionData(result: EncodedFeaturesResult): MarkRegionData {
  return {
    layers: result.layers.map((layer): StoredLayer => ({
      ...layer,
      flatbush: layer.flatbushData
        ? Flatbush.from(layer.flatbushData)
        : undefined,
    })),
  }
}

function highestRow(layers: Iterable<StoredLayer>) {
  let highest = 0
  for (const { row } of layers) {
    if (row) {
      for (let i = 0; i < row.length; i++) {
        if (row[i]! > highest) {
          highest = row[i]!
        }
      }
    }
  }
  return highest
}

// The config's raw slot values as the worker's encoding: a `jexl:` string
// crosses untouched, which is why nothing here reads through `getConf`.
function encodingOf(mark: MarkConfig): MarkEncoding {
  const { x, x2, y, row, glyph, color } = mark.encoding
  const scaled: ColorEncoding =
    color.scale === 'none'
      ? color.value
      : color.scale === 'categorical'
        ? {
            field: color.field,
            scale: 'categorical',
            palette: color.palette.length > 0 ? [...color.palette] : undefined,
            domain: color.domain.length > 0 ? [...color.domain] : undefined,
          }
        : {
            field: color.field,
            scale: color.scale,
            domain:
              color.domain.length === 2
                ? [Number(color.domain[0]), Number(color.domain[1])]
                : undefined,
            ramp:
              color.ramp.length === 0
                ? undefined
                : color.ramp.length === 1 && color.ramp[0] === 'viridis'
                  ? 'viridis'
                  : [...color.ramp],
          }
  const glyphEncoding: GlyphEncoding =
    glyph.scale === 'none'
      ? (glyph.value as GlyphEncoding)
      : {
          field: glyph.field,
          scale: 'categorical',
          range:
            glyph.range.length > 0
              ? ([...glyph.range] as GlyphName[])
              : undefined,
          domain: glyph.domain.length > 0 ? [...glyph.domain] : undefined,
        }
  return {
    x,
    x2,
    y: y === '' ? undefined : y,
    row: row === '' ? undefined : row,
    color: scaled,
    glyph: glyphEncoding,
  }
}

// The config's step list as the worker's, with the empty slot values that
// mean "default" left off the wire.
function transformOf(mark: MarkConfig): TransformStep[] {
  return mark.transform.map((step: MarkTransformStepConfig): TransformStep => {
    const as: string[] = [...step.as]
    switch (step.type) {
      case 'filter': {
        return { type: 'filter', expr: step.expr }
      }
      case 'formula': {
        return { type: 'formula', expr: step.expr, as: as[0] ?? 'value' }
      }
      case 'bin': {
        return {
          type: 'bin',
          step: step.step,
          field: step.field || undefined,
          as: as.length === 2 ? [as[0]!, as[1]!] : undefined,
        }
      }
      case 'aggregate': {
        return {
          type: 'aggregate',
          groupby: [...step.groupby],
          ops: step.ops.map(
            (o: Instance<typeof step.ops>[number]): AggregateOp => ({
              op: o.op,
              field: o.field || undefined,
              as: o.as || undefined,
            }),
          ),
        }
      }
      case 'coverage': {
        return { type: 'coverage', as: as[0] }
      }
    }
  })
}

function markEntryOf(mark: MarkConfig): MarkEntry {
  return {
    shape: mark.shape,
    minBpPerPx: mark.minBpPerPx,
    maxBpPerPx: mark.maxBpPerPx,
  }
}

function layerExtremes(entries: VisibleEntry<StoredLayer>[]) {
  let min = Infinity
  let max = -Infinity
  for (const { data } of entries) {
    min = Math.min(min, data.yMin)
    max = Math.max(max, data.yMax)
  }
  return Number.isFinite(min) ? { min, max } : undefined
}

/**
 * #stateModel LinearMarkDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * A display declared in config: a list of bar, point and span marks, each
 * with an encoding from feature fields to channels, drawn in order over one
 * score axis from one worker fetch per region.
 */
export function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: LinearMarkDisplayConfigModel,
) {
  return types
    .compose(
      'LinearMarkDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      WiggleScoreConfigMixin(),
      LegendMixin(),
      ContextMenuMixin<MarkDisplayContextMenuInfo>(),
      StoredHoverMixin<MarkHitInfo>(sameMarkHit),
      types.model({
        type: types.literal('LinearMarkDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * The "Filter by..." dialog's override of the `jexlFilters` slot,
         * `jexl:`-prefixed; unset follows the config.
         */
        jexlFiltersSetting: types.maybe(types.array(types.string)),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * The fetched layers, keyed by displayedRegionIndex — the foundation's
       * per-region store, narrowed.
       */
      get rpcDataMap(): ReadonlyMap<number, MarkRegionData> {
        return self.regionPayloads as ReadonlyMap<number, MarkRegionData>
      },
      /**
       * #getter
       * the config typed off the concrete schema
       */
      get conf(): LinearMarkDisplayConfig {
        return self.configuration
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the track label sits above the plot so the y-axis stays on the edge
       */
      get prefersOffset() {
        return true
      },
      /**
       * #getter
       * The declared marks' shapes, in draw order.
       */
      get markShapes(): MarkShapeName[] {
        return self.conf.marks.map((m: MarkConfig) => m.shape)
      },
      /**
       * #getter
       * Each mark's shape and zoom range, what the mark list is built from.
       */
      get markEntries(): MarkEntry[] {
        return self.conf.marks.map((m: MarkConfig) => markEntryOf(m))
      },
      /**
       * #getter
       * Whether each mark draws at the view's zoom: inside its
       * `minBpPerPx`..`maxBpPerPx` range, where 0 is no bound. What the
       * shared domain, the legend, the row count and the skipped chip fold.
       */
      get markVisible(): boolean[] {
        const { bpPerPx } = self.host
        return self.conf.marks.map((m: MarkConfig) =>
          markDrawsAt(markEntryOf(m), bpPerPx),
        )
      },
      /**
       * #method
       * A region's layers with a mark outside its zoom range replaced by an
       * empty one, so a fold over layers by index reads only what draws.
       */
      visibleLayers(data: MarkRegionData): StoredLayer[] {
        const { markVisible } = this
        return data.layers.map((layer, i) =>
          markVisible[i]
            ? layer
            : {
                ...layer,
                count: 0,
                row: undefined,
                scale: undefined,
                glyphScale: undefined,
              },
        )
      },
      /**
       * #getter
       * The declared marks' encodings, as the worker takes them.
       */
      get encodings(): MarkEncoding[] {
        return self.conf.marks.map((m: MarkConfig) => encodingOf(m))
      },
      /**
       * #getter
       * The worker request, one layer per mark: its encoding and the lanes
       * its shape reads.
       */
      get layerRequests(): LayerRequest[] {
        return self.conf.marks.map((m: MarkConfig) => {
          const shape: MarkShapeName = m.shape
          const transform = transformOf(m)
          return {
            encoding: encodingOf(m),
            lanes: [...SHAPE_LANES[shape]],
            ...(transform.length > 0 ? { transform } : {}),
          }
        })
      },
      /**
       * #getter
       */
      get origin(): number {
        return getConf(self, 'origin')
      },
      /**
       * #getter
       */
      get minWidthPx(): number {
        return getConf(self, 'minWidthPx')
      },
      /**
       * #getter
       * the `jexlFilters` slot, `jexl:`-prefixed
       */
      get configuredFilters() {
        return () => configuredJexlFilters(self)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The mark list the shapes declare — one `defineMark` per config entry,
       * reading `layers[i]`, off outside its zoom range. Recomputed only when
       * the entries move, which is what lets the component key its backend
       * factory on it.
       */
      get markList() {
        return buildMarkList(self.markEntries)
      },
      /**
       * #getter
       * The shapes drawing at the view's zoom.
       */
      get visibleShapes(): MarkShapeName[] {
        const { markVisible } = self
        return self.markShapes.filter((_, i) => markVisible[i])
      },
      /**
       * #getter
       */
      get hasBarMark(): boolean {
        return this.visibleShapes.includes('bar')
      },
      /**
       * #getter
       */
      get hasPointMark(): boolean {
        return this.visibleShapes.includes('point')
      },
      /**
       * #getter
       * the filters actually applied, `jexl:`-prefixed
       */
      get activeFilters(): string[] {
        return activeJexlFilters(self)
      },
      /**
       * #getter
       * nice-rounded [min, max] over the visible regions' shipped extremes,
       * widened to the origin whenever a bar mark draws, or undefined before
       * any valued mark loads
       */
      get domain() {
        const origin = self.origin
        const hasBar = this.hasBarMark
        const { markVisible } = self
        return visibleStatsDomain({
          active: this.visibleShapes.some(s => s !== 'span'),
          view: self.host,
          payloadFor: index => self.rpcDataMap.get(index),
          itemsFor: data =>
            data.layers.filter(
              (l, i) =>
                markVisible[i] && l.count > 0 && Number.isFinite(l.yMin),
            ),
          accumulate: layerExtremes,
          range: ({ min, max }) =>
            hasBar ? widenRangeToRules([min, max], [origin]) : [min, max],
          bounds: [self.minScoreBound, self.maxScoreBound],
          scaleType: 'linear',
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The y scale the chrome draws the axis from; the shapes place values
       * linearly, so the inherited `scaleType` slot is not consulted
       */
      get valueScales(): ValueScale[] {
        return [
          {
            domain: self.domain,
            scaleType: 'linear',
            height: self.height,
            minimalTicks: getConf(self, 'minimalTicks'),
          },
        ]
      },
      /**
       * #method
       * the fetch inputs SettingsInvalidate watches: each mark's encoding
       * and lanes, and the filters as transform steps, all evaluated in the
       * worker
       */
      rpcProps(): { layers: LayerRequest[]; transform: TransformStep[] } {
        return {
          layers: self.layerRequests,
          transform: self.activeFilters.map(expr => ({
            type: 'filter' as const,
            expr,
          })),
        }
      },
      /**
       * #getter
       * bands a span stacks into: the highest `row` any loaded layer
       * carries, plus one
       */
      get rowCount(): number {
        let highest = 0
        for (const data of self.rpcDataMap.values()) {
          highest = Math.max(highest, highestRow(self.visibleLayers(data)))
        }
        return highest + 1
      },
      /**
       * #getter
       * geometry and scale for the plot canvas, the same box the hit test
       * measures in
       */
      get renderState(): MarkRenderState {
        const canvasWidth = self.canvasWidthPx
        const canvasHeight = axisPlotBox(self.height).plotHeight
        return resolveRenderState(self.domain, domainY => ({
          domainY,
          canvasWidth,
          canvasHeight,
          bpPerPx: self.host.bpPerPx,
          origin: self.origin,
          minWidthPx: self.minWidthPx,
          pointDiameterPx: self.scatterPointSize,
          rowCount: this.rowCount,
        }))
      },
      /**
       * #getter
       * displayedRegionIndex → refName, for the hit test
       */
      get regionRefNames(): ReadonlyMap<number, string> {
        return new Map(
          self.host.visibleRegions.map(r => [
            r.displayedRegionIndex,
            r.refName,
          ]),
        )
      },
      /**
       * #getter
       * The box the hovered instance painted, for the chrome's highlight; the
       * context menu's hit stands in while a menu is open. In the chrome's px,
       * so the plot's inset is added to the canvas box.
       */
      get hoverInk(): HighlightRect[] {
        const hit = self.hoveredFeature ?? self.contextMenuInfo?.hit
        if (!hit) {
          return []
        }
        const top = axisPlotBox(self.height).yTop
        return inkOfInstances(
          self.markList,
          self.renderBlocks,
          index => self.rpcDataMap.get(index),
          this.renderState,
          index =>
            index === hit.regionIndex
              ? [{ mark: hit.markIndex, index: hit.instance }]
              : undefined,
        ).map(r => ({ ...r, top: r.top + top }))
      },
      /**
       * #getter
       * What the worker left out of the loaded regions — a feature whose
       * `y` field read as missing or not a number — for the corner notice.
       */
      get skippedFeatures(): SkippedFeatures {
        const { encodings, markVisible } = self
        return skippedFeatures(
          [...self.rpcDataMap.values()].map(d =>
            d.layers
              .map((layer, i) => ({
                count: layer.count,
                skipped: layer.skipped,
                field: encodings[i]?.y,
              }))
              .filter((_, i) => markVisible[i]),
          ),
        )
      },
      /**
       * #getter
       * the colour keys the loaded regions carry, one per scaled mark
       * drawing at the view's zoom
       */
      get legendSections() {
        return buildMarkLegend(
          [...self.rpcDataMap.values()].map(d => ({
            layers: self.visibleLayers(d),
          })),
        )
      },
      /**
       * #getter
       * `LegendMixin`'s hook: the keys as color scales, so the chrome and the
       * export draw the legend off the tables the worker resolved
       */
      get colorScales() {
        return markColorScales(this.legendSections)
      },
    }))
    .volatile(self => ({
      // The click-driven details fetch, lent the display's status window so
      // it reports through the same chip as the viewport fetch and a second
      // click supersedes the first.
      detailsRotation: createStopTokenRotation(self, {
        statusWindow: self.statusWindow,
      }),
    }))
    .actions(self => ({
      /**
       * #action
       * Open the feature widget for a hit: the worker shipped channels, not
       * records, so the feature is read back over its own span.
       */
      selectFeature(hit: MarkHitInfo) {
        const region: Region | undefined =
          self.host.displayedRegions[hit.regionIndex]
        if (!region) {
          return
        }
        const fetch = self.detailsRotation.begin()
        void withFeatureDetails(
          self,
          async () => {
            try {
              const features = await getSession(self).rpcManager.call(
                getRpcSessionId(self),
                'CoreGetFeatures',
                {
                  adapterConfig: self.adapterConfig,
                  regions: [
                    {
                      ...region,
                      start: hit.start,
                      end: Math.max(hit.end, hit.start + 1),
                    },
                  ],
                  stopToken: fetch.stopToken,
                  statusCallback: fetch.statusCallback,
                },
              )
              return fetch.isCurrent()
                ? features.find(
                    f =>
                      f.get('start') === hit.start && f.get('end') === hit.end,
                  )
                : undefined
            } finally {
              fetch.end()
            }
          },
          feature => {
            openFeatureWidget(self, feature.toJSON(), { feature })
          },
        )
      },
      /**
       * #action
       * Stage a region as fetched, with this display's payload shape.
       */
      setRpcData(idx: number, data: EncodedFeaturesResult, region: Region) {
        self.setLoadedRegion(idx, region, storedRegionData(data))
      },
      /**
       * #action
       */
      setJexlFilters(filters?: string[]) {
        self.jexlFiltersSetting = cast(filters)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return [
          makeScoreSubMenu(self, { scaleType: false, autoscale: false }),
          ...makePointSizeSubMenu(self, {
            label: 'Point size',
            applies: self.hasPointMark,
          }),
          ...filterMenuItems({
            narrowings: { jexlFilters: jexlFilterNarrowing(self) },
            onEdit: () => {
              getDialogHost(self).queueDialog(handleClose => [
                JexlFilterDialog,
                { model: self, handleClose },
              ])
            },
          }),
          ...makeShowSubMenu([
            makeCrossHatchItem(self),
            legendCheckboxItem(self),
          ]),
        ]
      },
      /**
       * #method
       */
      contextMenuItems(): MenuItem[] {
        const hit = self.contextMenuInfo?.hit
        return hit
          ? [
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  self.selectFeature(hit)
                },
              },
            ]
          : []
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      fetchNeeded(needed: IndexedRegion[]) {
        return fetchEachRegion(self, needed, {
          call: (region, ctx) =>
            ctx.callRpc('CoreEncodeFeatures', { ...rpcArgs(self), region }),
          onResult: (_idx, result) => storedRegionData(result),
        })
      },
      /**
       * #action
       * identity encode — the stored payload is what the backend uploads
       */
      startRenderingBackend(backend: MarkRenderingBackend) {
        installUpload(self, backend, {
          cells: () => self.rpcDataMap,
          render: b =>
            b.renderBlocks(
              self.renderBlocks,
              self.rpcDataMap,
              self.renderState,
            ),
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
}

export type LinearMarkDisplayStateModel = ReturnType<typeof stateModelFactory>
export interface LinearMarkDisplayModel extends Instance<LinearMarkDisplayStateModel> {}
