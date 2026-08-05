import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchAllRegions,
} from '@jbrowse/plugin-linear-genome-view'
import {
  computeYTicks,
  makeCrossHatchItem,
  makeShowSubMenu,
} from '@jbrowse/wiggle-core'
import PaletteIcon from '@mui/icons-material/Palette'

import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { installWiggleRenderingBackend } from '../shared/installWiggleRenderingBackend.ts'
import { wiggleColorAdornment } from '../shared/wiggleColorAdornment.tsx'
import { makeWiggleRenderState } from '../shared/wiggleComponentUtils.ts'
import {
  makeLineWidthMenuItems,
  makePointSizeMenuItems,
  makeRenderingTypeSubMenu,
  makeResolutionSubMenu,
  makeWiggleScoreSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import {
  SINGLE_WIGGLE_SOURCE_NAME,
  WIGGLE_RENDERINGS,
  YSCALEBAR_LABEL_OFFSET,
} from '../util.ts'

import type { SatisfiesComponentContract } from '../shared/componentContract.ts'
import type { WiggleDataResult } from '../util.ts'
import type { WiggleDisplayModel } from './components/wiggleDisplayTypes.ts'
import type { LinearWiggleDisplayConfigSchema } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { WiggleRenderingBackend } from '@jbrowse/wiggle-core'

export type { Region } from '@jbrowse/core/util'

const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

/**
 * #stateModel LinearWiggleDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * #category display
 *
 * State model factory for the single-source wiggle display.
 *
 * #example
 * A complete `QuantitativeTrack` config to paste into `tracks`. `height` and the
 * score-range and rendering options (autoscale, min/max score, renderer) are all
 * config slots on the track itself — see the `QuantitativeTrack` config:
 * ```js
 * {
 *   type: 'QuantitativeTrack',
 *   trackId: 'coverage',
 *   name: 'Coverage',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
 *   displays: [
 *     {
 *       type: 'LinearWiggleDisplay',
 *       displayId: 'coverage-LinearWiggleDisplay',
 *       height: 100,
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: LinearWiggleDisplayConfigSchema,
) {
  return types
    .compose(
      'LinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      WiggleCommonMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearWiggleDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get color(): string {
        return getConf(self, 'color')
      },

      /**
       * #getter
       */
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST getter named after config slot
      get useBicolor(): boolean {
        return getConf(self, 'useBicolor')
      },

      /**
       * #getter
       * Overrides WiggleScoreConfigMixin's `false` base, which is what its
       * `showCrossHatches` / `effectiveSummaryScoreMode` getters key on.
       */
      get isDensityMode() {
        return self.renderingType === 'density'
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get ticks() {
        return computeYTicks({
          height: self.height,
          domain: self.domain,
          scaleType: self.scaleType,
          minimalTicks: getConf(self, 'minimalTicks'),
        })
      },

      /**
       * #getter
       * Offset the track label above the plot so the left y-axis stays pinned
       * to the content edge instead of dodging right of the label. Density mode
       * draws no left axis (just a top score legend), so let the label overlap.
       */
      get prefersOffset() {
        return !self.isDensityMode
      },

      /**
       * #getter
       * The color ramp the density legend draws, or undefined when there is no
       * single ramp to describe. Lives on the model so the on-screen legend and
       * the SVG export can't disagree about whether density has a ramp.
       *
       * Single-wiggle density always draws from posColor (the config doc for
       * `color` says so), so with bicolor off there is only one side to describe
       * and the plain [min, max] text stays the honest legend.
       */
      get scoreRamp() {
        return self.isDensityMode && self.useBicolor
          ? {
              posColor: self.posColor,
              negColor: self.negColor,
              pivot: self.bicolorPivot,
              gradientId: `score-ramp-${self.id}`,
            }
          : undefined
      },

      /**
       * #getter
       */
      get renderState() {
        const view = self.lgv
        return makeWiggleRenderState(self, {
          width: view.trackWidthPx,
          // inset by the scalebar label gutter at top and bottom so the plot
          // never overlaps the axis labels drawn in those bands
          height: self.height - 2 * YSCALEBAR_LABEL_OFFSET,
          numRows: 1,
        })
      },

      /**
       * #method
       */
      rpcProps() {
        return {
          useBicolor: self.useBicolor,
          bicolorPivot: self.bicolorPivot,
          resolution: self.resolution,
        }
      },

      /**
       * #method
       * single-source gpuProps mapped onto the multi-source build path:
       * - bicolor: no source color override; build emits pos+neg with their
       *   respective colors
       * - solid: worker put all features in pos arrays (useBicolor=false);
       *   non-density modes use the user's color; density uses posColor
       *   (multi default, so leave source.color undefined)
       *
       * Solid mode overrides `negColor` too, not just the source color. The
       * worker's pos/neg split only covers the 'avg' path; whiskers (the
       * default summaryScoreMode) re-derives the split on the main thread from
       * bicolorPivot and would otherwise paint every sub-pivot band in the
       * negColor slot, so `color: 'green'` on signed data came back green/red.
       */
      gpuProps() {
        const wantsSolidColor = !self.useBicolor && !self.isDensityMode
        return {
          sources: [
            {
              name: SINGLE_WIGGLE_SOURCE_NAME,
              color: wantsSolidColor ? self.color : undefined,
            },
          ],
          posColor: self.posColor,
          negColor: wantsSolidColor ? self.color : self.negColor,
          summaryScoreMode: self.summaryScoreMode,
          isDensityMode: self.isDensityMode,
          renderingType: self.renderingType,
          bicolorPivot: self.bicolorPivot,
          maxGapMultiple: self.maxGapMultiple,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRpcData(displayedRegionIndex: number, data: WiggleDataResult) {
        self.rpcDataMap.set(displayedRegionIndex, data)
      },

      /**
       * #action
       */
      setUseBicolor(val?: boolean) {
        setConf(self, 'useBicolor', val)
      },

      /**
       * #action
       */
      setColor(color?: string) {
        setConf(self, 'color', color)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        const view = self.lgv
        const { adapterConfig } = self
        const { bpPerPx } = view
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        return fetchAllRegions(self, needed, {
          call: (regions, ctx) =>
            rpcManager.call(sessionId, 'RenderWiggleData', {
              adapterConfig,
              regions,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
              bpPerPx,
              // One batched call for every region, so there is nothing to
              // aggregate: the plain status callback, not the per-region one
              // the fan-out displays use to merge N concurrent bars.
              statusCallback: self.makeStatusCallback(),
            }),
          onResult: (idx, result) => {
            self.setRpcData(idx, result)
          },
          onComplete: () => {
            self.setLoadedBpPerPx(bpPerPx)
          },
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems() {
        return [
          makeRenderingTypeSubMenu(self, WIGGLE_RENDERINGS),
          ...makeResolutionSubMenu(self),
          makeWiggleScoreSubMenu(self),
          // cross hatches are meaningless in density mode (score maps to color,
          // not height), which `showCrossHatches` also enforces on the drawing
          // side so a hatch enabled elsewhere doesn't strand itself here
          ...makeShowSubMenu(
            self.isDensityMode ? [] : [makeCrossHatchItem(self)],
          ),
          // point size / line width are top-level submenus, each present only in
          // its respective scatter / line rendering
          ...makePointSizeMenuItems(self),
          ...makeLineWidthMenuItems(self),
          {
            label: 'Edit color...',
            icon: PaletteIcon,
            // current color shown inline so the menu reads out the state
            // without opening the dialog
            endAdornment: wiggleColorAdornment(self),
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SetColorDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
        ]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearWiggleDisplayModel, opts)
      },
      /**
       * #action
       */
      startRenderingBackend(backend: WiggleRenderingBackend) {
        installWiggleRenderingBackend(self, backend)
      },
    }))
}

export type LinearWiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearWiggleDisplayModel = Instance<LinearWiggleDisplayStateModel>

// See SatisfiesComponentContract for why this guard exists and why it's spelled
// out in each model file rather than centralized.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesComponentContract = SatisfiesComponentContract<
  WiggleDisplayModel,
  LinearWiggleDisplayModel
>
