import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchAllRegions,
} from '@jbrowse/plugin-linear-genome-view'
import {
  axisPlotBox,
  computeYTicks,
  makeCrossHatchItem,
  makeScoreNormalizer,
  parseScoreRules,
  resolveSymlogConstant,
  scaleTypeFromString,
  scoreRuleMarks,
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
import { SINGLE_WIGGLE_SOURCE_NAME, WIGGLE_RENDERINGS } from '../util.ts'

import type { SatisfiesComponentContract } from '../shared/componentContract.ts'
import type { WiggleDisplayModel } from './components/wiggleDisplayTypes.ts'
import type { LinearWiggleDisplayConfigSchema } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type {
  WiggleDataResult,
  WiggleRenderingBackend,
} from '@jbrowse/wiggle-core'

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
          symlogConstant: self.symlogConstant,
          height: self.height,
          domain: self.domain,
          scaleType: self.scaleType,
          minimalTicks: getConf(self, 'minimalTicks'),
        })
      },

      /**
       * #getter
       * Screen positions for the configured reference rules, or `[]`. Built
       * from the display's own normalizer rather than a linear read of the
       * domain, so a rule stays on the data it is meant to be read against when
       * the axis is log or symlog.
       *
       * Empty in density mode for the reason `showCrossHatches` is false there:
       * density spends color rather than height on the score, so there is no
       * axis for a rule to sit on and a line across it would read as a
       * threshold in a picture that has none.
       */
      get scoreRuleMarks() {
        const domain = self.domain
        if (!domain || self.isDensityMode) {
          return []
        }
        const [min, max] = domain
        return scoreRuleMarks({
          rules: parseScoreRules(getConf(self, 'scoreRules')),
          domain,
          box: axisPlotBox(self.height),
          normalize: makeScoreNormalizer(
            min,
            max,
            scaleTypeFromString(self.scaleType),
            resolveSymlogConstant(min, max, self.symlogConstant),
          ),
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
        return makeWiggleRenderState(self, {
          width: self.canvasWidthPx,
          // inset by the scalebar label gutter at top and bottom so the plot
          // never overlaps the axis labels drawn in those bands — the same box
          // `ticks` places itself in, which is why both read it from one helper
          height: axisPlotBox(self.height).plotHeight,
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
       * Solid mode overrides `negColor` too, not just the source color, and it
       * does so in density as well, where the source color is deliberately left
       * alone. The worker's pos/neg split only covers the 'avg' path. Every
       * mode that draws a summary band (whiskers, min, max) re-derives the
       * split on the main thread from bicolorPivot, and a negColor slot that
       * does not match paints the sub-pivot half in an unrelated color:
       * `color: 'green'` on signed data came back green/red, and a solid-color
       * density track set to Minimum came back posColor above the pivot and
       * negColor below it, against a legend describing a single ramp.
       */
      gpuProps() {
        // The one color the plot draws in when bicolor is off. Density ignores
        // the `color` slot and always draws from posColor (see that slot's
        // config doc, and `scoreRamp`, which describes no negative side there).
        const solidColor = self.isDensityMode ? self.posColor : self.color
        return {
          sources: [
            {
              name: SINGLE_WIGGLE_SOURCE_NAME,
              // no override in density: solidColor is already the posColor the
              // build falls back to
              color:
                !self.useBicolor && !self.isDensityMode
                  ? self.color
                  : undefined,
            },
          ],
          posColor: self.posColor,
          negColor: self.useBicolor ? self.negColor : solidColor,
          effectiveSummaryScoreMode: self.effectiveSummaryScoreMode,
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
              // One batched call for every region, so `ctx.statusCallback` here
              // is the whole fetch's rather than a fan-out slot — same field
              // either way, which is the point of it living on the ctx.
              statusCallback: ctx.statusCallback,
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
