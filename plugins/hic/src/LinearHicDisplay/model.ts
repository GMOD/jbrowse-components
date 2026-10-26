import {
  ConfigurationReference,
  getConf,
  getSlotDefinition,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getBpDisplayStr } from '@jbrowse/core/util'
import {
  installPrerequisiteFetch,
  readFor,
} from '@jbrowse/core/util/installPrerequisiteFetch'
import { clipQuantileOf } from '@jbrowse/core/util/quantileExtent'
import GlobalFetchMixin from '@jbrowse/display-kit/GlobalFetchMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MatrixRampMixin from '@jbrowse/display-kit/MatrixRampMixin'
import PointerHoverMixin from '@jbrowse/display-kit/PointerHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import TriangleMatrixMixin from '@jbrowse/display-kit/TriangleMatrixMixin'
import { colorForField } from '@jbrowse/display-kit/colorConfigSchema'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { triangleAxis } from '@jbrowse/display-kit/triangleTransform'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'

import { computeCountStats } from '../RenderHicDataRPC/countStats.ts'
import { findContactAt } from './contactLookup.ts'
import { HIC_FIELD_PRESETS } from './hicColorConfigSchema.ts'
import { hicCountFloors, hicFilterProblems } from './hicFilter.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type { HicHeader } from '../HicAdapter/HicAdapter.ts'
import type {
  HicContactItem,
  HicCountFloors,
  HicDataResult,
} from '../RenderHicDataRPC/types.ts'
import type {
  HicRenderState,
  HicRenderingBackend,
} from './components/hicRenderingBackendTypes.ts'
import type { HicTrackConfig, HicTrackConfigModel } from './configSchema.ts'
import type { HicColorField, HicColorScale } from './hicColorConfigSchema.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { AdapterRead } from '@jbrowse/core/util/installPrerequisiteFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type React from 'react'

// The fallback order when the selected normalization is not in the file.
const NORMALIZATION_PREFERENCE = ['KR', 'SCALE', 'VC_SQRT', 'VC']

// The key's and the tooltip's name for a value: the field's own title, its
// normalization and, for a count, a scale other than linear. A ratio is always
// log.
function valueName(
  field: { name: string; isCount: boolean },
  normalization: string,
  scale?: HicColorScale,
) {
  const qualifiers = [
    normalization === 'NONE' ? undefined : normalization,
    field.isCount && scale !== undefined && scale !== 'linear'
      ? scale
      : undefined,
  ].filter(q => q !== undefined)
  return qualifiers.length
    ? `${field.name} (${qualifiers.join(', ')})`
    : field.name
}

/**
 * #stateModel LinearHicDisplay
 * #displayFoundation GlobalFetchMixin
 * #category display
 * The Hi-C contact matrix as a triangle over the view.
 *
 * #example
 * A `HicTrack` whose display pins the color scale's top, so two tracks set
 * alike share one scale, and runs one binsize coarser than the zoom picks:
 * ```js
 * {
 *   type: 'HicTrack',
 *   trackId: 'hic',
 *   name: 'Hi-C',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
 *   displays: [
 *     {
 *       type: 'LinearHicDisplay',
 *       displayId: 'hic-LinearHicDisplay',
 *       encoding: {
 *         color: { scale: { type: 'symlog', domainMax: 500 } },
 *       },
 *       data: { resolution: -1 },
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(configSchema: HicTrackConfigModel) {
  return types
    .compose(
      'LinearHicDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalFetchMixin(),
      LegendMixin(),
      MatrixRampMixin(HIC_FIELD_PRESETS),
      TriangleMatrixMixin<HicDataResult>(),
      PointerHoverMixin<HicContactItem>(
        (a, b) =>
          a.bin1 === b.bin1 &&
          a.bin2 === b.bin2 &&
          a.region1Idx === b.region1Idx &&
          a.region2Idx === b.region2Idx,
      ),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearHicDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * The file's normalizations and binsizes, stamped with the adapter
       * config they answer.
       */
      fileInfo: undefined as AdapterRead<HicHeader> | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get availableNormalizations(): string[] | undefined {
        return readFor(self, self.fileInfo)?.norms
      },
      /**
       * #getter
       * Smallest first, so a positive `data.resolution` is always finer.
       */
      get availableResolutions(): number[] | undefined {
        return readFor(self, self.fileInfo)?.resolutions
      },
      /**
       * #getter
       * Whether the adapter names a control, which observed/control needs.
       */
      get hasControl(): boolean {
        return self.adapterConfig.controlAdapter != null
      },
      /**
       * #getter
       * `data.resolution`: binsizes finer than the zoom's pick.
       */
      get resolutionSteps(): number {
        return getConf(self, ['data', 'resolution'])
      },
      /**
       * #getter
       * `encoding.color.scale.domainQuantile`: the quantile of the loaded
       * counts an unset `domainMax` follows, their maximum at 1.
       */
      get colorQuantile(): number {
        return getConf(self, ['encoding', 'color', 'scale', 'domainQuantile'])
      },
      /**
       * #getter
       * Whether an unset `encoding.color.scale.domainMax` saturates at
       * `colorQuantile` rather than the counts' maximum.
       */
      get colorFollowsPercentile(): boolean {
        return this.colorQuantile < 1
      },
      /**
       * #getter
       * The quantile "Emphasize faint contacts" saturates at: `colorQuantile`
       * while it clips, else the one ticking it writes. Each fetch asks the
       * worker for this one whichever is drawn, so the toggle reselects
       * nothing.
       */
      get saturationQuantile(): number {
        return this.colorFollowsPercentile
          ? this.colorQuantile
          : clipQuantileOf(
              getSlotDefinition(
                self.configuration.encoding.color.scale,
                'domainQuantile',
              ).defaultValue,
            )
      },
      /**
       * #getter
       * `data.normalization`, the one asked for.
       */
      get selectedNormalization(): string {
        return getConf(self, ['data', 'normalization'])
      },
      /**
       * #getter
       * `encoding.color.field`, what the fetch asks the worker to put in
       * each cell.
       */
      get colorField(): HicColorField {
        return getConf(self, ['encoding', 'color', 'field'])
      },
      /**
       * #getter
       * The `filter` list's floors on a cell's counts, which the worker
       * applies before the ratio.
       */
      get countFloors(): HicCountFloors {
        return hicCountFloors(self.configuration.filter)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The field the loaded cells are: observed/expected falls back to the
       * counts where the file has no expected values at the binsize.
       */
      get paintedColorField(): HicColorField {
        return self.rpcData?.appliedField ?? self.colorField
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the binsize list has arrived; every resolution control gates
       * on it.
       */
      get hasResolutions(): boolean {
        return !!self.availableResolutions?.length
      },
      /**
       * #getter
       * The normalization to request: the selection where the file has it,
       * else the next best it does. A getter, so a file lacking the selection
       * never marks the track edited.
       */
      get activeNormalization(): string {
        const avail = self.availableNormalizations
        const selected = self.selectedNormalization
        return !avail || avail.includes(selected)
          ? selected
          : (NORMALIZATION_PREFERENCE.find(n => avail.includes(n)) ??
              avail[0] ??
              'NONE')
      },
      /**
       * #getter
       * The loaded counts' `saturationQuantile`: the worker's answer, or after
       * an edit a selection over the loaded matrix, so a new percentile
       * refetches nothing. The next fetch asks the worker for the new one.
       */
      get loadedQuantileScore(): number {
        const data = self.rpcData
        const q = self.saturationQuantile
        return !data
          ? 0
          : data.quantile === q
            ? data.quantileScore
            : computeCountStats(data.instances, data.numContacts, q)
                .quantileScore
      },
    }))
    .views(self => ({
      /**
       * #getter
       * What an open end of the color domain follows: the loaded values from
       * 0, which is where a count's extent starts, to their `colorQuantile`
       * below 1, else their maximum.
       */
      get colorExtent(): readonly [number, number] {
        const data = self.rpcData
        return [
          0,
          !data
            ? 0
            : self.colorFollowsPercentile
              ? self.loadedQuantileScore
              : data.maxScore,
        ]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Retry is two-stage: the contact fetch declines until the header it
       * needs lands, and the header's arrival wakes it. `infoFetchFailure.test.ts`
       * pins it.
       */
      get awaitingPrerequisite(): boolean {
        return !self.hasResolutions
      },
      /**
       * #getter
       * The normalization the loaded matrix has, which falls back per
       * binsize (KR at 5 kb, nothing at 2.5 Mb is typical). The menu ticks
       * this. Fetch-derived, so it stays out of `rpcProps()`.
       */
      get appliedNormalization(): string {
        return self.rpcData?.appliedNormalization ?? self.activeNormalization
      },
      /**
       * #getter
       * The painted field's name for the key and the tooltip.
       */
      get paintedFieldName() {
        return {
          name: self.colorFieldTitle,
          isCount: self.paintedColorField === 'observed',
        }
      },
      /**
       * #getter
       * The binsize index auto mode picks: the largest at most 2 bp/px, about
       * half a bin per pixel, else the finest.
       */
      get autoResolutionIdx(): number {
        const avail = self.availableResolutions
        if (!avail?.length) {
          return -1
        }
        const bpPerPx = Math.max(1, self.host.bpPerPx)
        const idx = avail.findLastIndex(binSize => binSize <= 2 * bpPerPx)
        return idx === -1 ? 0 : idx
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The value ramp. A top below the largest loaded value reads `≥`. The
       * title names the loaded binsize, so a figure carries it, unless
       * `encoding.color.legend.title` replaces it.
       */
      get colorScales(): ColorScale[] {
        const { rpcData } = self
        const label = valueName(
          self.paintedFieldName,
          self.appliedNormalization,
          self.colorScaleType,
        )
        return self.rampColorScales({
          id: 'contacts',
          title: rpcData
            ? `${label} · ${getBpDisplayStr(rpcData.resolution)}`
            : label,
          // the counts start at the key's bottom; a ratio's smallest value
          // is not scored, and one below a fixed domain's bottom is usual
          extent: {
            min: self.paintedColorField === 'observed' ? undefined : 0,
            max: rpcData?.maxScore ?? 0,
          },
        })
      },
      /**
       * #getter
       * The index in effect after `resolutionSteps`, clamped so steps set at
       * another zoom cannot index out of range.
       */
      get effectiveResolutionIdx(): number {
        const avail = self.availableResolutions
        return avail?.length
          ? Math.max(
              0,
              Math.min(
                avail.length - 1,
                self.autoResolutionIdx - self.resolutionSteps,
              ),
            )
          : -1
      },
      /**
       * #getter
       * What the tooltip calls a bin's value.
       */
      get valueLabel(): string {
        return valueName(self.paintedFieldName, self.appliedNormalization)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get effectiveResolution(): number | undefined {
        return self.availableResolutions?.[self.effectiveResolutionIdx]
      },
      /**
       * #getter
       */
      get canStepResolutionFiner(): boolean {
        return self.effectiveResolutionIdx > 0
      },
      /**
       * #getter
       */
      get canStepResolutionCoarser(): boolean {
        const avail = self.availableResolutions
        return (
          avail !== undefined && self.effectiveResolutionIdx < avail.length - 1
        )
      },
      /**
       * #getter
       */
      get renderState(): HicRenderState {
        return { ...self.triangleFrame, color: self.matrixColor }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The static blocks plus the binsize, so a pan inside them redraws and
       * only a block entering or a binsize step refetches. Undefined until the
       * header lands.
       */
      get viewSignature(): string | undefined {
        const blocks = self.staticBlockSignature
        const resolution = self.effectiveResolution
        return blocks !== undefined && resolution !== undefined
          ? `${blocks}|res:${resolution}`
          : undefined
      },
      /**
       * #method
       * The settings that refetch. The binsize is zoom-derived and the
       * quantile reselects on the main thread, so both ride as call
       * arguments.
       */
      rpcProps(): {
        normalization: string
        field: HicColorField
        floors: HicCountFloors
      } {
        return {
          normalization: self.activeNormalization,
          field: self.colorField,
          floors: self.countFloors,
        }
      },
      /**
       * #method
       * The contact under a display-px point, through the inverse of the
       * transform the matrix was drawn with.
       */
      hitTest(mouseX: number, mouseY: number): HicContactItem | undefined {
        const data = self.rpcData
        if (!data || data.numContacts === 0) {
          return undefined
        }
        const { x, y } = self.screenToCell(mouseX, mouseY)
        return findContactAt(data, x, y)
      },
      /**
       * #method
       * No contact while the matrix loads: a global display replaces its
       * whole frame, so the cells it holds are on their way out.
       */
      hoverHitAt(mouseX: number, mouseY: number) {
        return self.isLoadingOrCanceled
          ? undefined
          : this.hitTest(mouseX, mouseY)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      startRenderingBackend(backend: HicRenderingBackend) {
        installUpload(self, backend, {
          cells: () => self.matrixRegions,
          render: b =>
            b.renderBlocks(
              self.matrixBlocks,
              self.matrixRegions,
              self.renderState,
            ),
        })
      },
      /**
       * #action
       * What the cells show; a new field starts from its own preset, so a
       * count's scheme or pinned top does not carry onto a ratio.
       */
      setColorField(field: HicColorField) {
        if (field !== self.colorField) {
          setConf(
            self,
            ['encoding', 'color'],
            colorForField(
              getSnapshot<ColorSlots>(self.configuration.encoding.color),
              field,
            ),
          )
        }
      },
      /**
       * #action
       * The Log scale toggle: `encoding.color.scale.type` symlog, which keeps
       * every nonzero count visible, or unset for `observed`'s linear preset.
       */
      setLogScale(log: boolean) {
        setConf(
          self,
          ['encoding', 'color', 'scale', 'type'],
          log ? 'symlog' : undefined,
        )
      },
      /**
       * #action
       */
      setColorFollowsPercentile(f: boolean) {
        setConf(
          self,
          ['encoding', 'color', 'scale', 'domainQuantile'],
          f ? self.saturationQuantile : 1,
        )
      },
      /**
       * #action
       */
      setSelectedNormalization(f: string) {
        setConf(self, ['data', 'normalization'], f)
      },
      /**
       * #action
       */
      setFileInfo(read: AdapterRead<HicHeader>) {
        self.fileInfo = read
      },
      /**
       * #action
       */
      resetResolution() {
        setConf(self, ['data', 'resolution'], 0)
      },
      /**
       * #action
       * Lock to `availableResolutions[idx]`, clamped, stored as an offset from
       * the auto pick so the choice keeps its meaning across zoom.
       */
      setResolutionIdx(idx: number) {
        const avail = self.availableResolutions
        if (avail?.length) {
          const clamped = Math.max(0, Math.min(avail.length - 1, idx))
          setConf(
            self,
            ['data', 'resolution'],
            self.autoResolutionIdx - clamped,
          )
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Lock to a binsize the file offers; any other is ignored.
       */
      setResolution(binSize: number) {
        const idx = self.availableResolutions?.indexOf(binSize) ?? -1
        if (idx !== -1) {
          self.setResolutionIdx(idx)
        }
      },
      /**
       * #action
       */
      stepResolution(delta: number) {
        self.setResolutionIdx(self.effectiveResolutionIdx + delta)
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        configProblemsOf: superConfigProblemsOf,
      } = self
      return {
        /**
         * #method
         * The schema's rules, then the `filter` entries the worker cannot
         * apply.
         */
        configProblemsOf(conf: AnyConfigurationModel): string[] {
          const hic = conf as HicTrackConfig
          return [
            ...superConfigProblemsOf(conf),
            ...hicFilterProblems(
              hic.filter,
              readConfObject(hic, ['encoding', 'color', 'field']),
            ),
          ]
        },
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            ...buildHicTrackMenuItems(self),
            ...editPlotMenuItems(self),
          ]
        },
        /**
         * #method
         */
        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearHicDisplayModel, opts)
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // The header read every contact fetch waits on. An empty binsize list
        // is as terminal as a throw: the contact fetch would decline forever
        // and hang the view's SVG export on `svgReady`.
        installPrerequisiteFetch(self, {
          report: { statusWindow: self.statusWindow },
          run: async (adapterConfig, ctx) =>
            (await ctx.callRpc('CoreGetInfo', {
              adapterConfig,
            })) as Partial<HicHeader> | null,
          commit: ({ adapterConfig, value }) => {
            const resolutions = value?.resolutions
            if (resolutions?.length) {
              self.setFileInfo({
                adapterConfig,
                value: {
                  norms: value?.norms ?? [],
                  resolutions: [...resolutions].sort((a, b) => a - b),
                },
              })
            } else {
              self.setError(
                new Error(
                  'No contact-matrix resolutions found in this .hic file',
                ),
              )
            }
          },
          setError: error => {
            self.setError(error)
          },
          delay: 0,
          name: 'LinearHicDisplayInfo',
        })

        installGlobalFetchAutorun(self, {
          prepare: () => {
            const resolution = self.effectiveResolution
            const blocks = self.host.staticBlocks.contentBlocks
            if (resolution === undefined || !blocks.length) {
              return undefined
            }
            // The worker sees neither the view's axis nor its pre-rename
            // refNames, so both travel beside the regions.
            const { originBp, axisBlocks } = triangleAxis(
              blocks,
              self.host.displayedRegions,
            )
            return { resolution, regions: [...blocks], axisBlocks, originBp }
          },
          run: async ({ resolution, regions, axisBlocks, originBp }, ctx) =>
            await ctx.callRpc('RenderHicData', {
              ...rpcArgs(self),
              regions,
              axisBlocks,
              originBp,
              resolution,
              quantile: self.saturationQuantile,
            }),
          commit: result => {
            self.setRpcData(result)
          },
          delay: 1000,
          name: 'LinearHicDisplayRender',
        })
      },
    }))
}

export type LinearHicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearHicDisplayModel = Instance<LinearHicDisplayStateModel>
