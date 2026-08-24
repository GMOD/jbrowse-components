import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import MultiRegionDisplayMixin, {
  fetchAllRegions,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'
import {
  axisPlotBox,
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
import { wiggleDisplayViews } from '../shared/wiggleDisplayViews.ts'
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
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
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

      /**
       * #getter
       * The configured rules, parsed. Config is user-authored JSON, so this is
       * where the unusable entries are dropped rather than at each reader.
       */
      get scoreRules() {
        return parseScoreRules(getConf(self, 'scoreRules'))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overrides WiggleCommonMixin's empty base, so the axis reaches a
       * configured rule even where the visible data does not — see
       * `widenRangeToRules`.
       *
       * Empty in density mode, and it has to be: density draws no rules
       * (`scoreRuleMarks`) but spends the domain on its color ramp, so widening
       * it there stretches the ramp over a range nothing on screen reaches and
       * washes the plot out for a mark nobody can see. Same trap
       * `effectiveSummaryScoreMode` exists for.
       */
      get scoreRuleValues() {
        return self.isDensityMode ? [] : self.scoreRules.map(r => r.value)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The single plot, inset by the scalebar label gutter at top and bottom
       * so it never overlaps the axis labels drawn in those bands. `ticks`, the
       * render height, the on-screen canvas and the SVG clip all read it, which
       * is what keeps a tick on the data it labels.
       */
      get plotGeometry() {
        const { yTop, plotHeight } = axisPlotBox(self.height)
        return { yTop, plotHeight, numRows: 1, tickHeight: self.height }
      },

      /**
       * #getter
       * Single-wiggle density always draws from posColor (the config doc for
       * `color` says so), so with bicolor off there is only one side to
       * describe and the plain [min, max] text stays the honest legend.
       */
      get scoreRampApplies() {
        return self.isDensityMode && self.useBicolor
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
          rules: self.scoreRules,
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
    }))
    .views(self => wiggleDisplayViews(self))
    .views(self => ({
      /**
       * #method
       * `useBicolor` is a fetch key because the worker is what splits the
       * features into the pos and neg arrays (ADR-016).
       */
      rpcProps() {
        return {
          ...self.sharedRpcProps(),
          useBicolor: self.useBicolor,
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
        // The one color the plot draws in when bicolor is off. Density
        // ignores the `color` slot and always draws from posColor (see that
        // slot's config doc, and `scoreRamp`, which describes no negative
        // side there).
        const solidColor = self.isDensityMode ? self.posColor : self.color
        return {
          ...self.sharedGpuProps(),
          sources: [
            {
              name: SINGLE_WIGGLE_SOURCE_NAME,
              // no override in density: solidColor is already the posColor
              // the build falls back to
              color:
                !self.useBicolor && !self.isDensityMode
                  ? self.color
                  : undefined,
            },
          ],
          negColor: self.useBicolor ? self.negColor : solidColor,
        }
      },
    }))
    .actions(self => ({
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
        const { adapterConfig } = self
        const { bpPerPx } = self.lgv
        return fetchAllRegions(self, needed, {
          call: (regions, ctx) =>
            ctx.callRpc('RenderWiggleData', {
              adapterConfig,
              regions,
              ...self.rpcProps(),
              bpPerPx,
            }),
          onResult: (idx, result) => {
            self.setRpcData(idx, result)
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
              getDialogHost(self).queueDialog(handleClose => [
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
