import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { darkAtLowEnd, rampLutOf } from '@jbrowse/core/util/colorRamp'
import {
  installPrerequisiteFetch,
  readFor,
} from '@jbrowse/core/util/installPrerequisiteFetch'
import { formatScore } from '@jbrowse/core/util/numericUtils'
import GlobalFetchMixin from '@jbrowse/display-kit/GlobalFetchMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import TriangleMatrixMixin from '@jbrowse/display-kit/TriangleMatrixMixin'
import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { triangleAxis } from '@jbrowse/display-kit/triangleTransform'
import { types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'
import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  denormalizeScore,
} from '@jbrowse/render-core/scoreScale'

import { legendStops } from './components/colorRamp.ts'
import { findContactAt } from './contactLookup.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../RenderHicDataRPC/types.ts'
import type {
  HicRenderState,
  HicRenderingBackend,
} from './components/hicRenderingBackendTypes.ts'
import type { HicTrackConfigModel } from './configSchema.ts'
import type { HicColorScale } from './hicColorConfigSchema.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { AdapterRead } from '@jbrowse/core/util/installPrerequisiteFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type React from 'react'

// How far the key sits below the resolution box when that box holds the
// corner. The box's height is the UA `<select>`'s at fontSize 10, measured at
// 15-18px across font stacks, so this errs high.
export const RESOLUTION_ROW_CLEARANCE = 28

// The fallback order when the selected normalization is not in the file.
const NORMALIZATION_PREFERENCE = ['KR', 'SCALE', 'VC_SQRT', 'VC']

function contactsLabel(normalization: string, log = false) {
  const qualifiers = [
    normalization === 'NONE' ? undefined : normalization,
    log ? 'log' : undefined,
  ].filter(q => q !== undefined)
  return qualifiers.length ? `Contacts (${qualifiers.join(', ')})` : 'Contacts'
}

interface HicFileInfo {
  norms: string[] | undefined
  resolutions: number[]
}

/**
 * #stateModel LinearHicDisplay
 * #displayFoundation GlobalFetchMixin
 * #category display
 * The Hi-C contact matrix as a triangle over the view.
 *
 * #example
 * A `HicTrack` whose display pins the colour scale's top, so two tracks set
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
 *       color: { scale: 'log', domainMax: 500 },
 *       resolutionBias: 1,
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
      TriangleMatrixMixin<HicDataResult>(),
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
      fileInfo: undefined as AdapterRead<HicFileInfo> | undefined,
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
       * Smallest first, so a negative `resolutionBias` is always finer.
       */
      get availableResolutions(): number[] | undefined {
        return readFor(self, self.fileInfo)?.resolutions
      },
      /**
       * #getter
       */
      get resolutionBias(): number {
        return getConf(self, 'resolutionBias')
      },
      /**
       * #getter
       */
      get colorScaleType(): HicColorScale {
        return getConf(self, ['color', 'scale'])
      },
      /**
       * #getter
       */
      get colorScheme(): ColorSchemeName {
        return getConf(self, ['color', 'scheme'])
      },
      /**
       * #getter
       * `color.reverse`, or where unset whether the scheme runs dark at its
       * low end.
       */
      get colorReverse(): boolean {
        return (
          getConf(self, ['color', 'reverse']) ?? darkAtLowEnd(this.colorScheme)
        )
      },
      /**
       * #getter
       * The ramp's 256 entries: the GPU's texture, the Canvas2D fill and the
       * legend read this one table.
       */
      get colorRamp(): Uint8Array {
        return rampLutOf({
          scheme: this.colorScheme,
          reverse: this.colorReverse,
        })
      },
      /**
       * #getter
       */
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST getter named after config slot
      get useColorPercentile(): boolean {
        return getConf(self, 'useColorPercentile')
      },
      /**
       * #getter
       */
      get showResolutionControls(): boolean {
        return getConf(self, 'showResolutionControls')
      },
      /**
       * #getter
       */
      get selectedNormalization(): string {
        return getConf(self, 'selectedNormalization')
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
       * The domain the counts are coloured over. An unset `domainMax` follows
       * the loaded counts: their 95th percentile under `useColorPercentile`,
       * else their maximum.
       */
      get colorDomain(): [number, number] {
        const data = self.rpcData
        const pinnedMax: number | undefined = getConf(self, [
          'color',
          'domainMax',
        ])
        const loadedMax = !data
          ? 0
          : self.useColorPercentile
            ? data.percentile95
            : data.maxScore
        return [
          getConf(self, ['color', 'domainMin']) ?? 0,
          pinnedMax ?? loadedMax,
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
       * Whether the resolution box is up; the chrome starts the key below it.
       */
      get showResolutionBox(): boolean {
        return self.showResolutionControls && self.hasResolutions
      },
      /**
       * #getter
       */
      get legendTop(): number {
        return this.showResolutionBox ? RESOLUTION_ROW_CLEARANCE : 0
      },
      /**
       * #getter
       * The normalization the loaded matrix carries, which falls back per
       * binsize (KR at 5 kb, nothing at 2.5 Mb is typical). The menu ticks
       * this. Fetch-derived, so it stays out of `rpcProps()`.
       */
      get appliedNormalization(): string {
        return self.rpcData?.appliedNormalization ?? self.activeNormalization
      },
      /**
       * #getter
       */
      get scaleType() {
        return self.colorScaleType === 'log'
          ? SCALE_TYPE_LOG
          : SCALE_TYPE_LINEAR
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
       * The count ramp, once there is a domain to span. The ends are where
       * the ramp paints them, and a top below the largest loaded count reads
       * `≥`.
       */
      get colorScales(): ColorScale[] {
        const [lo, hi] = self.colorDomain
        const { scaleType } = self
        const domain: [number, number] = [
          denormalizeScore(0, lo, hi, scaleType, 1),
          hi,
        ]
        if (!(domain[1] > domain[0])) {
          return []
        }
        const maxScore = self.rpcData?.maxScore ?? 0
        return [
          {
            kind: 'ramp',
            id: 'contacts',
            title: contactsLabel(
              self.appliedNormalization,
              scaleType === SCALE_TYPE_LOG,
            ),
            domain,
            stops: legendStops(self.colorRamp),
            format: (v: number) =>
              v === domain[1] && v < maxScore
                ? `≥${formatScore(v)}`
                : formatScore(v),
          },
        ]
      },
      /**
       * #getter
       * The index in effect after `resolutionBias`, clamped so a bias set at
       * another zoom cannot index out of range.
       */
      get effectiveResolutionIdx(): number {
        const avail = self.availableResolutions
        return avail?.length
          ? Math.max(
              0,
              Math.min(
                avail.length - 1,
                self.autoResolutionIdx + self.resolutionBias,
              ),
            )
          : -1
      },
      /**
       * #getter
       * What the tooltip calls a bin's value.
       */
      get valueLabel(): string {
        return contactsLabel(self.appliedNormalization)
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
        const [domainMin, domainMax] = self.colorDomain
        return {
          ...self.triangleFrame,
          domainMin,
          domainMax,
          scaleType: self.scaleType,
          colorRamp: self.colorRamp,
        }
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
       * The settings that refetch. The binsize is zoom-derived, so it travels
       * as its own argument.
       */
      rpcProps(): { normalization: string } {
        return { normalization: self.activeNormalization }
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
       */
      setColorScale(scale: HicColorScale) {
        setConf(self, ['color', 'scale'], scale)
      },
      /**
       * #action
       */
      setUseColorPercentile(f: boolean) {
        setConf(self, 'useColorPercentile', f)
      },
      /**
       * #action
       */
      setShowResolutionControls(f: boolean) {
        setConf(self, 'showResolutionControls', f)
      },
      /**
       * #action
       * The scheme, with `reverse` back to unset so it follows the scheme.
       */
      setColorScheme(scheme: ColorSchemeName) {
        setConf(self, ['color', 'scheme'], scheme)
        setConf(self, ['color', 'reverse'], undefined)
      },
      /**
       * #action
       */
      setActiveNormalization(f: string) {
        setConf(self, 'selectedNormalization', f)
      },
      /**
       * #action
       */
      setFileInfo(read: AdapterRead<HicFileInfo>) {
        self.fileInfo = read
      },
      /**
       * #action
       */
      resetResolutionBias() {
        setConf(self, 'resolutionBias', 0)
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
          setConf(self, 'resolutionBias', clamped - self.autoResolutionIdx)
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
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [...superTrackMenuItems(), ...buildHicTrackMenuItems(self)]
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
            (await ctx.callRpc('CoreGetInfo', { adapterConfig })) as {
              norms?: string[]
              resolutions?: number[]
            },
          commit: ({ adapterConfig, value: { norms, resolutions } }) => {
            if (resolutions?.length) {
              self.setFileInfo({
                adapterConfig,
                value: {
                  norms,
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
