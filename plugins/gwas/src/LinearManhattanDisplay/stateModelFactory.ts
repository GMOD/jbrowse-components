import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost, openFeatureWidget, toLocale } from '@jbrowse/core/util'
import { categoricalField } from '@jbrowse/core/util/categoricalField'
import Flatbush from '@jbrowse/core/util/flatbush'
import {
  MAX_LEGEND_ENTRIES,
  derivedColorScale,
} from '@jbrowse/core/util/legendCandidates'
import {
  thresholdCuts,
  thresholdKeyEntries,
} from '@jbrowse/core/util/thresholdScale'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import LegendMixin, {
  legendCheckboxItem,
} from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import { skippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import {
  colorEncodingOf,
  colorForField,
  paintedScale,
} from '@jbrowse/display-kit/colorConfigSchema'
import { colorNotices, fieldScaleOf } from '@jbrowse/display-kit/colorScale'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances } from '@jbrowse/render-core/marks'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'
import {
  ScoreFieldConfigMixin,
  axisPlotBox,
  makeCrossHatchItem,
  makeScoreSubMenu,
  resolveRenderState,
  unionRanges,
  visibleStatsRange,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import {
  makePointSizeSubMenu,
  scatterPointSizeAccess,
} from '@jbrowse/wiggle-core/chrome'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'

import { LD_FIELD, MANHATTAN_FIELD_SCALES } from './colorConfigSchema.ts'
import {
  LD_LEGEND_TITLE,
  isLdColoring,
  ldColorDefaults,
  ldLegend,
} from './ldBins.ts'
import { MANHATTAN_MARKS } from './manhattanMarks.ts'

import type {
  ManhattanColorScale,
  ManhattanRpcResult,
} from '../ManhattanRPC/rpcTypes.ts'
import type {
  ManhattanContextMenuInfo,
  ManhattanDisplayModel,
} from './components/manhattanDisplayTypes.ts'
import type {
  LinearManhattanDisplayConfig,
  LinearManhattanDisplayConfigModel,
} from './configSchemaFactory.ts'
import type { ManhattanHit } from './findManhattanHit.ts'
import type {
  ManhattanRenderState,
  ManhattanRenderingBackend,
  StoredManhattanData,
} from './manhattanRenderingBackendTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'
import type { Region } from '@jbrowse/core/util/types/data'
import type { SkippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ValueScale } from '@jbrowse/wiggle-core'

function storedManhattanData(data: ManhattanRpcResult): StoredManhattanData {
  return {
    ...data,
    flatbush: data.flatbushData ? Flatbush.from(data.flatbushData) : undefined,
  }
}

const SetColorFieldDialog = lazy(
  () => import('./components/SetColorFieldDialog.tsx'),
)

// The LD key's rows, and — where nothing matched the index SNP — a note saying
// so, or an export where every point is grey sits under a full r² key that
// implies the colors mean something.
function ldScale(
  color: { domain: readonly string[]; range: readonly string[] },
  indexSnpMissing: boolean,
): ColorScale {
  return {
    kind: 'categorical',
    id: 'ld',
    title: LD_LEGEND_TITLE,
    ...(indexSnpMissing
      ? { note: 'No LD data for the index SNP: every other point is grey' }
      : {}),
    entries: ldLegend(color).map(({ label, color, shape }) => ({
      value: label,
      label,
      swatches: [{ color, shape }],
    })),
  }
}

/**
 * #stateModel LinearManhattanDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * GWAS Manhattan-plot display drawing -log10 p-values as a scored scatter along
 * the genome, with a feature widget on click.
 */
export function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: LinearManhattanDisplayConfigModel,
) {
  return (
    types
      .compose(
        'LinearManhattanDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        ScoreFieldConfigMixin(),
        LegendMixin(),
        ContextMenuMixin<ManhattanContextMenuInfo>(),
        StoredHoverMixin<ManhattanHit>(),
        types.model({
          type: types.literal('LinearManhattanDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           * Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based)
           * string. Auto-tracks the highest-scoring loaded SNP unless the user
           * pins one (see `indexSnpPinned`).
           */
          indexSnp: types.maybe(types.string),
          /**
           * #property
           * True once the user pins a specific index SNP (right-clicking a point).
           * While false, the index auto-tracks the top hit as data loads.
           */
          indexSnpPinned: types.stripDefault(types.boolean, false),
        }),
      )
      .views(self => ({
        /**
         * #getter
         * The fetched points, keyed by displayedRegionIndex — the foundation's
         * per-region store, narrowed to this display's payload.
         */
        get rpcDataMap(): ReadonlyMap<number, StoredManhattanData> {
          return self.regionPayloads as ReadonlyMap<number, StoredManhattanData>
        },
        /**
         * #getter
         * the config typed off the concrete schema; `ConfigurationReference`
         * erases `self.configuration` to `any`, so reads route through this to
         * stay typed
         */
        get conf(): LinearManhattanDisplayConfig {
          return self.configuration
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The `color` object as the config spells it, no default filled in.
         * `value` is read raw rather than through `getConf`, which would
         * evaluate a `jexl:` callback against no feature and throw; the worker
         * binds `feature` and evaluates it per point
         * (`colorSlotTransport.test.ts`).
         */
        get writtenColor() {
          return {
            value: self.conf.color.value,
            field: getConf(self, ['color', 'field']),
            scale: getConf(self, ['color', 'scale']),
            domain: getConf(self, ['color', 'domain']),
            range: getConf(self, ['color', 'range']),
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Offset the track label above the plot so the -log10(p) y-axis stays
         * pinned to the content edge instead of dodging right of the label.
         */
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * The `color` object as painted, its `scale` the one that paints and
         * LD's default cuts and colours filled in; `rpcProps` hands it to the
         * worker as the encoder takes it.
         */
        get color(): ColorSetting & {
          value: string
          scale: ManhattanColorScale
        } {
          const written = self.writtenColor
          const { field } = written
          const scale = paintedScale(
            written,
            fieldScaleOf(MANHATTAN_FIELD_SCALES, field),
          )
          return {
            ...written,
            scale,
            ...(isLdColoring({ field, scale }) ? ldColorDefaults(written) : {}),
          }
        },
        /**
         * #getter
         * the PLINK .ld sub-adapter configured on the track's `GWASAdapter`, or
         * undefined when none is set (the slot defaults to null, normalized here
         * to undefined for "absent")
         */
        get ldAdapterConfig(): Record<string, unknown> | undefined {
          // array slot path off the LIVE parent track, not a read against
          // `self.adapterConfig` — that is itself a snapshot, and
          // `types.stripDefault` omits a slot at its default, so a slot read
          // against a snapshot can report a defaulted slot as absent
          return (
            getConf(self.parentTrack, ['adapter', 'ldAdapter']) ?? undefined
          )
        },
        /**
         * #getter
         * LD coloring needs a configured .ld adapter; without one the LD
         * controls are inert, so they're hidden/disabled
         */
        get hasLdData(): boolean {
          return this.ldAdapterConfig !== undefined
        },
        /**
         * #getter
         * LD coloring is in effect: `field: 'ld'` on a threshold scale *and* an
         * .ld adapter to read r² from. Without the adapter the worker reads
         * `ld` off the features like any other threshold field, so every LD
         * affordance (the r² key, the missing-index warning) keys off this.
         */
        get ldColoringActive(): boolean {
          return isLdColoring(this.color) && this.hasLdData
        },
        /**
         * #getter
         * [min, max] -log10 p across the visible regions, or undefined before
         * any data loads: the union of the extremes the worker shipped, so a
         * block contributes its whole region's rather than the part it shows.
         *
         * Widened to reach every `scales.y.rules` entry, as the wiggle displays
         * widen theirs. A threshold answers "does anything here clear it?", so
         * the window where the answer is no — every score well under the line —
         * is the one where an unwidened axis drops the line and leaves the
         * reader nothing to read the plot against. `widenRangeToRules` applies
         * to the raw range, so an explicit `scales.y` bound still wins.
         */
        get autoscaleRange() {
          const rules = self.scoreRules
          return visibleStatsRange({
            active: true,
            view: self.host,
            payloadFor: index => self.rpcDataMap.get(index),
            itemsFor: data => (data.count === 0 ? [] : [data]),
            accumulate: entries =>
              unionRanges(entries.map(({ data }) => [data.yMin, data.yMax])),
            range: extremes =>
              widenRangeToRules(
                extremes,
                rules.map(rule => rule.value),
              ),
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get domain() {
          return self.autoscaledDomain
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The y scale the chrome draws the axis from. Manhattan plots are
         * linear-only — `scales.y.type` admits nothing else, since the points
         * are pre-transformed -log10 p values. Its thresholds are the scale's
         * rules, which the chrome and the export both draw off the axis.
         */
        get valueScales(): ValueScale[] {
          return [
            {
              domain: self.domain,
              scaleType: self.scaleType,
              height: self.height,
              minimalTicks: getConf(self, 'minimalTicks'),
              rules: self.scoreRules,
            },
          ]
        },
        /**
         * #method
         * fetch inputs watched by SettingsInvalidate — any change (score field,
         * color, index SNP, LD adapter) triggers a refetch, since the worker
         * reads the field and bakes per-feature color into the result
         */
        rpcProps(): {
          scoreField: string
          color: ColorEncoding
          indexSnp: string | undefined
          ldAdapterConfig: Record<string, unknown> | undefined
        } {
          return {
            scoreField: self.scoreField,
            color: colorEncodingOf(self.color, 'categorical'),
            indexSnp: self.indexSnp,
            ldAdapterConfig: self.ldAdapterConfig,
          }
        },
        /**
         * #getter
         * render geometry for the inner canvas (between top/bottom YScaleBar label
         * offsets) — the area both the GPU renderer and findManhattanHit work in.
         * Using self.height directly would drift the hit-test off the rendered
         * points.
         */
        get renderState(): ManhattanRenderState {
          const canvasWidth = self.canvasWidthPx
          const canvasHeight = axisPlotBox(self.height).plotHeight
          return resolveRenderState(self.domain, domainY => ({
            domainY,
            canvasWidth,
            canvasHeight,
            pointDiameterPx: self.scatterPointSize,
          }))
        },
        /**
         * #getter
         * A ring around the hovered point, for the chrome's highlight: the
         * glyph's box grown to the ring's radius, which sits a fixed margin
         * outside the point and floors at 6 px so a tiny point stays findable.
         * A ring rather than a shade because a wash over a 4 px glyph is
         * invisible, and every hue is taken by the colour schemes.
         */
        get hoverInk(): HighlightRect[] {
          const hit = self.hoveredFeature
          if (!hit) {
            return []
          }
          const plotTop = axisPlotBox(self.height).yTop
          const r = Math.max(6, self.scatterPointSize / 2 + 4)
          return inkOfInstances(
            MANHATTAN_MARKS,
            self.renderBlocks,
            index => self.rpcDataMap.get(index),
            this.renderState,
            index =>
              index === hit.regionIndex
                ? [{ mark: 0, index: hit.instance }]
                : undefined,
          ).map(box => ({
            left: box.left + box.width / 2 - r,
            top: plotTop + box.top + box.height / 2 - r,
            width: 2 * r,
            height: 2 * r,
          }))
        },
        /**
         * #getter
         */
        get highlightStyle(): HighlightStyle {
          return 'ring'
        },
        /**
         * #getter
         * What the worker left out of the loaded regions — a feature whose
         * `scoreField` read as missing or not a number — for the corner
         * notice.
         */
        get skippedFeatures(): SkippedFeatures {
          const field = self.scoreField
          return skippedFeatures(
            [...self.rpcDataMap.values()].map(d => [
              { count: d.count, skipped: d.skipped, field },
            ]),
          )
        },
        /**
         * #getter
         * What the `color` object's slots say together that it cannot paint
         * as written, for the corner notice.
         */
        get notices(): string[] {
          const written = self.writtenColor
          return colorNotices(
            written,
            fieldScaleOf(MANHATTAN_FIELD_SCALES, written.field),
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * highest-scoring loaded SNP as a `chr:bp` (1-based) string — the default
         * LD index SNP. Derived from loaded data (not a fetch input), so it's
         * applied via the auto-pick autorun rather than read into rpcProps.
         *
         * Regions are scanned in ascending index order, not rpcDataMap insertion
         * order, so ties break the same way every load. Exact ties at the top are
         * routine — `negLog10` clamps every underflowed p=0 to the same ~323.3 —
         * and rpcDataMap is cleared and refilled in RPC-resolution order on each
         * recolor. Adopting whichever tied SNP happened to land first would make
         * topSnp flip between them, and since adopting it refetches, the display
         * would livelock and never paint (see ldAutoIndex.test.ts).
         */
        get topSnp(): string | undefined {
          let bestScore = -Infinity
          let bestPos = 0
          let bestIdx = -1
          const indexes = [...self.rpcDataMap.keys()].sort((a, b) => a - b)
          for (const idx of indexes) {
            // hoisted out of the loop: this walks every SNP of every loaded
            // region, and a whole-genome GWAS puts hundreds of thousands in
            // each, so the two array lookups are the loop body
            const { y, x, count } = self.rpcDataMap.get(idx)!
            for (let i = 0; i < count; i++) {
              const s = y[i]!
              if (s > bestScore) {
                bestScore = s
                bestPos = x[i]!
                bestIdx = idx
              }
            }
          }
          const view = self.host
          const refName =
            bestIdx === -1 ? undefined : view.displayedRegions[bestIdx]?.refName
          return refName ? `${refName}:${bestPos + 1}` : undefined
        },
        /**
         * #getter
         * true when LD coloring is active with data loaded, but no region's LD
         * data referenced the index SNP — so every point is grey. LD is a
         * single-region analysis, so "found in no loaded region" means missing:
         * absent from the file, named differently there than in the GWAS
         * file, or on a contig none of the loaded regions are.
         */
        get indexSnpMissing(): boolean {
          return (
            self.ldColoringActive &&
            self.indexSnp !== undefined &&
            self.rpcDataMap.size > 0 &&
            ![...self.rpcDataMap.values()].some(d => d.indexFound)
          )
        },
        /**
         * #getter
         * Fills MultiRegionDisplayMixin's supersession hook, and is the
         * auto-pick's trigger: the loaded data was colored under an index SNP
         * other than the top hit, so adopting it — an `rpcProps` write — will
         * clear the data and refetch. Keyed on the `ld` scale rather than
         * `ldColoringActive`, because the auto-pick writes whether or not an
         * `ldAdapter` is configured, and an export sampling `svgReady` must
         * not capture the load that write discards.
         */
        get dataSuperseded(): boolean {
          return (
            isLdColoring(self.color) &&
            !self.indexSnpPinned &&
            this.topSnp !== undefined &&
            this.topSnp !== self.indexSnp
          )
        },
        /**
         * #getter
         * `LegendMixin`'s hook: the scale the active scheme paints through,
         * or none under the single color, which has no key. The r² bins under
         * LD coloring; under field coloring the values the loaded regions met,
         * read off the payloads' scale tables — the same table the worker
         * packed `color` from, so a swatch is a color that was drawn. The chrome draws the key on screen and in the export.
         */
        get colorScales(): ColorScale[] {
          if (self.ldColoringActive) {
            return [ldScale(self.color, this.indexSnpMissing)]
          }
          const { scale, field, domain, range } = self.color
          if (scale === 'threshold') {
            const tables = [...self.rpcDataMap.values()].map(d => d.scale)
            const met = (flag: 'missing' | 'notNumber') =>
              tables.some(t => t?.kind === 'threshold' && t[flag])
            return [
              {
                kind: 'categorical',
                id: 'field',
                title: field,
                entries: thresholdKeyEntries(thresholdCuts(domain), range, {
                  missing: met('missing'),
                  notNumber: met('notNumber'),
                }),
              },
            ]
          }
          if (scale === 'categorical') {
            // Every point of a region carries the same table, so the region is
            // its own source and every entry paints: the display has no rows
            // to hide a color behind.
            return derivedColorScale(
              self.rpcDataMap.values(),
              ({ scale }) => ({
                candidates:
                  scale?.kind === 'categorical'
                    ? scale.entries.map(entry => ({ rowIndex: 0, ...entry }))
                    : [],
                rowPaintsCandidateColor: () => true,
              }),
              {
                id: 'field',
                field: categoricalField(field, { domain, range }),
                maxItems: MAX_LEGEND_ENTRIES,
              },
            )
          }
          return []
        },
      }))
      .actions(self => {
        // From the colour as written, so a switch writes no LD default into
        // the config
        function colorBy(field: string) {
          setConf(self, 'color', colorForField(self.writtenColor, field))
        }
        return {
          /**
           * #action
           * open the feature details widget for a clicked point
           */
          selectFeature(hit: ManhattanHit) {
            openFeatureWidget(self, {
              uniqueId: `manhattan-${hit.refName}-${hit.start}`,
              refName: hit.refName,
              start: hit.start,
              end: hit.end,
              score: hit.score,
              r2: hit.r2,
            })
          },
          /**
           * #action
           * Stage a region as fetched — the store's raw write with this
           * display's payload shape, so a test stands up a loaded display in one
           * call. Production goes through `ctx.commitRegion`.
           */
          setRpcData(idx: number, data: ManhattanRpcResult, region: Region) {
            self.setLoadedRegion(idx, region, storedManhattanData(data))
          },
          /**
           * #action
           * `none` paints every point `value`; `categorical` paints the field
           * again. The scale alone, so switching back to the field finds its
           * order and palette as written.
           */
          setColorScale(scale: Exclude<ManhattanColorScale, 'threshold'>) {
            setConf(self, ['color', 'scale'], scale)
          },
          /**
           * #action
           * Color by the values of a feature field. Re-picking the field keeps
           * its order and palette; a new field starts from neither.
           */
          colorByField(field: string) {
            colorBy(field)
          },
          /**
           * #action
           * Color each point by its r² to the index SNP: the `ld` field, read
           * from the adapter's `ldAdapter`.
           */
          colorByLd() {
            colorBy(LD_FIELD)
          },
          /**
           * #action
           */
          setIndexSnp(snp?: string) {
            self.indexSnp = snp
          },
          /**
           * #action
           * right-click "Color by LD to this SNP": switch into LD mode and pin the
           * index on the clicked point, so the auto-pick stops tracking the top hit.
           * Keyed by chr:bp (1-based) to match the worker's posKey. All mutations
           * happen in one action so rpcProps settles once and only a single recolor
           * fetch fires.
           */
          colorByLdToHit(hit: ManhattanHit) {
            colorBy(LD_FIELD)
            self.indexSnp = `${hit.refName}:${hit.start + 1}`
            self.indexSnpPinned = true
          },
          /**
           * #action
           * release a pinned index back to auto-tracking, seeded at the current top
           * hit (the auto-pick autorun then keeps it on the top hit as data loads)
           */
          // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST action named for its semantic meaning, not a React hook
          useTopHitAsIndex() {
            self.indexSnpPinned = false
            self.indexSnp = self.topSnp
          },
        }
      })
      .views(self => ({
        /**
         * #method
         * Manhattan track menu: shared Score submenu plus LD-coloring controls.
         * Rendering type / Resolution / Scale type don't apply to single-point
         * rendering of pre-transformed -log10 p values. Placed after the
         * color/index actions so referencing them doesn't make MST inference
         * circular.
         */
        trackMenuItems() {
          return [
            // Neither radio is drawn, because `scales.y` declares one scale
            // type and no autoscale mode: the domain is plain min/max over the
            // loaded regions with the manual bounds applied on top. Set min/max
            // score is the one score control that does anything here.
            makeScoreSubMenu(self, { domain: self.domain }),
            ...makePointSizeSubMenu({
              label: 'Point size',
              applies: true,
              ...scatterPointSizeAccess(self),
            }),
            ...makeShowSubMenu([
              makeCrossHatchItem(self),
              ...(self.hasLegendKey ? [legendCheckboxItem(self)] : []),
            ]),
            {
              label: 'Color by...',
              icon: PaletteIcon,
              subMenu: [
                {
                  label: 'Single color',
                  type: 'radio' as const,
                  checked: self.color.scale === 'none',
                  onClick: () => {
                    self.setColorScale('none')
                  },
                },
                {
                  label:
                    self.color.scale === 'categorical'
                      ? `Field (${self.color.field})...`
                      : 'Field...',
                  type: 'radio' as const,
                  checked: self.color.scale === 'categorical',
                  onClick: () => {
                    getDialogHost(self).queueDialog(handleClose => [
                      SetColorFieldDialog,
                      { display: self, handleClose },
                    ])
                  },
                },
                ...(self.hasLdData
                  ? [
                      {
                        label: 'LD to index SNP',
                        type: 'radio' as const,
                        checked: isLdColoring(self.color),
                        onClick: () => {
                          self.colorByLd()
                        },
                      },
                    ]
                  : []),
              ],
            },
            {
              // whole submenu greys out without a configured .ld adapter
              label: 'LD options',
              disabled: !self.hasLdData,
              disabledHelpText: 'Requires a configured LD (PLINK .ld) adapter',
              subMenu: [
                {
                  label: 'Set index SNP to top hit',
                  disabled:
                    !isLdColoring(self.color) ||
                    !self.topSnp ||
                    !self.indexSnpPinned,
                  onClick: () => {
                    self.useTopHitAsIndex()
                  },
                },
              ],
            },
          ]
        },
        /**
         * #method
         * right-click menu for the point in `contextMenuInfo`: feature details
         * plus, when an LD adapter is configured, a shortcut to recolor by LD
         * to that SNP
         */
        contextMenuItems(): MenuItem[] {
          const hit = self.contextMenuInfo?.hit
          if (!hit) {
            return []
          }
          return [
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                self.selectFeature(hit)
              },
            },
            ...(self.hasLdData
              ? [
                  {
                    label: `Color by LD to ${hit.refName}:${toLocale(hit.start + 1)}`,
                    onClick: () => {
                      self.colorByLdToHit(hit)
                    },
                  },
                ]
              : []),
          ]
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        fetchNeeded(needed: IndexedRegion[]) {
          return fetchEachRegion(self, needed, {
            call: (region, ctx) =>
              ctx.callRpc('GetManhattanData', { ...rpcArgs(self), region }),
            onResult: (_idx, result) => storedManhattanData(result),
          })
        },
        /**
         * #action
         * identity encode — RPC result is the upload payload
         */
        startRenderingBackend(backend: ManhattanRenderingBackend) {
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
      // Its own block, after `startRenderingBackend`: the export types `self` as
      // the same `ManhattanDisplayModel` slice the component takes, and MST
      // doesn't type a block's own members onto its `self`, so declaring this
      // alongside them left that contract unsatisfied.
      .actions(self => ({
        /**
         * #action
         */
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .actions(self => {
        return {
          afterAttach() {
            // LocusZoom-style default: while no index SNP is pinned, keep the
            // index anchored on the highest-scoring loaded SNP, re-tracking it as
            // higher-scoring data lands.
            //
            // indexSnp is both a fetch input and derived from the loaded data,
            // so it is adopted only from a complete load: mid-batch, topSnp is
            // the winner among whatever arrived so far, and adopting it would
            // refetch forever (ldAutoIndex.test.ts).
            namedAutorun(
              self,
              () => {
                if (
                  self.dataSuperseded &&
                  self.viewportWithinLoadedData &&
                  !self.isLoading
                ) {
                  self.setIndexSnp(self.topSnp)
                }
              },
              { name: 'ManhattanAdoptTopSnp' },
            )
          },
        }
      })
  )
}

export type LinearManhattanDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearManhattanDisplayModel =
  Instance<LinearManhattanDisplayStateModel>

// Compile-time proof the real MST model still satisfies the structural type its
// component takes. A `DisplayType`'s `ReactComponent` is typed
// `AnyReactComponentType`, so registering the pair erases the prop type and a
// renamed/dropped field would be a silent runtime failure inside the lazy
// component. The slice itself stays hand-rolled for `renderSvg.tsx`'s sake —
// see manhattanDisplayTypes.ts. Type-only, so it's erased at runtime; it lives
// in this file (not a standalone one) so a "remove files with no importers"
// sweep can't drop the guard.
type _ComponentContract<T extends ManhattanDisplayModel> = T
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesComponentContract =
  _ComponentContract<LinearManhattanDisplayModel>
