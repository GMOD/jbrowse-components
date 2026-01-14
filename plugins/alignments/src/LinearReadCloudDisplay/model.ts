import type React from 'react'
import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { chainToSimpleFeature } from '../LinearReadArcsDisplay/chainToSimpleFeature.ts'
import { calculateCloudTicks } from '../RenderLinearReadCloudDisplayRPC/drawFeatsCloud.ts'
import { LinearReadDisplayBaseMixin } from '../shared/LinearReadDisplayBaseMixin.ts'
import { LinearReadDisplayWithLayoutMixin } from '../shared/LinearReadDisplayWithLayoutMixin.ts'
import { LinearReadDisplayWithPairFiltersMixin } from '../shared/LinearReadDisplayWithPairFiltersMixin.ts'
import { SharedModificationsMixin } from '../shared/SharedModificationsMixin.ts'
import {
  calculateSvgLegendWidth,
  getReadDisplayLegendItems,
} from '../shared/legendUtils.ts'
import {
  getColorSchemeMenuItem,
  getEditFiltersMenuItem,
  getMismatchDisplayMenuItem,
} from '../shared/menuItems.ts'

import type { ReducedFeature } from '../shared/types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
} from '@jbrowse/plugin-linear-genome-view'

const SetFeatureHeightDialog = lazy(
  () => import('./components/SetFeatureHeightDialog.tsx'),
)

/**
 * #stateModel LinearReadCloudDisplay
 * it is not a block based track, hence not BaseLinearDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReadCloudDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      LinearReadDisplayBaseMixin(),
      LinearReadDisplayWithLayoutMixin(),
      LinearReadDisplayWithPairFiltersMixin(),
      SharedModificationsMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearReadCloudDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        drawCloud: false,

        /**
         * #property
         * Whether to remove spacing between stacked features
         */
        noSpacing: types.maybe(types.boolean),

        /**
         * #property
         * Maximum height for the layout (prevents infinite stacking)
         */
        trackMaxHeight: types.maybe(types.number),

        /**
         * #property
         */
        hideSmallIndelsSetting: types.maybe(types.boolean),

        /**
         * #property
         */
        hideMismatchesSetting: types.maybe(types.boolean),

        /**
         * #property
         */
        hideLargeIndelsSetting: types.maybe(types.boolean),

        /**
         * #property
         */
        showLegend: types.maybe(types.boolean),

        /**
         * #property
         */
        showYScalebar: types.optional(types.boolean, true),

        /**
         * #property
         */
        showOutline: types.optional(types.boolean, true),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * Current height of the layout after drawing
       */
      layoutHeight: 0,
      /**
       * #volatile
       * Chain ID of the currently selected feature for persistent highlighting
       */
      selectedFeatureId: undefined as string | undefined,
      /**
       * #volatile
       * Max distance for cloud mode scale (min is always 1 for log scale)
       */
      cloudMaxDistance: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * Get the color settings (from override or configuration)
       */
      get colorBy() {
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },
      /**
       * #getter
       * Get the filter settings (from override or configuration)
       */
      get filterBy() {
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Reload the display (clears error state)
       */
      reload() {
        self.error = undefined
      },
    }))
    .views(self => ({
      get dataTestId() {
        return self.drawCloud ? 'cloud-canvas' : 'stack-canvas'
      },
      /**
       * #getter
       */
      get featureHeightSetting() {
        return self.featureHeight ?? getConf(self, 'featureHeight')
      },
      /**
       * #getter
       */
      get hideSmallIndels() {
        return self.hideSmallIndelsSetting ?? getConf(self, 'hideSmallIndels')
      },
      /**
       * #getter
       */
      get hideMismatches() {
        return self.hideMismatchesSetting ?? getConf(self, 'hideMismatches')
      },
      /**
       * #getter
       */
      get hideLargeIndels() {
        return self.hideLargeIndelsSetting ?? getConf(self, 'hideLargeIndels')
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get modificationThreshold() {
        return self.colorBy?.modifications?.threshold ?? 10
      },
      /**
       * #getter
       * Domain for cloud mode scale: [1, maxDistance]
       * Uses 1 as lower bound since it's a log scale
       */
      get cloudDomain(): [number, number] | undefined {
        if (self.cloudMaxDistance === undefined) {
          return undefined
        }
        return [1, self.cloudMaxDistance]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Calculate ticks for the y-axis scalebar in cloud mode
       */
      get cloudTicks() {
        if (!self.drawCloud || !self.cloudDomain || !self.showYScalebar) {
          return undefined
        }
        return calculateCloudTicks(self.cloudDomain, self.height)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Set whether to remove spacing between features
       */
      setNoSpacing(flag?: boolean) {
        self.noSpacing = flag
      },
      /**
       * #action
       * Set the maximum height for the layout
       */
      setMaxHeight(n?: number) {
        self.trackMaxHeight = n
      },
      /**
       * #action
       * Set the current layout height
       */
      setLayoutHeight(n: number) {
        self.layoutHeight = n
      },
      /**
       * #action
       * Set the max distance for cloud mode scale
       * Only updates if value differs by more than EPSILON to avoid infinite re-renders
       */
      setCloudMaxDistance(maxDistance: number) {
        const EPSILON = 0.000001
        if (
          self.cloudMaxDistance === undefined ||
          Math.abs(self.cloudMaxDistance - maxDistance) > EPSILON
        ) {
          self.cloudMaxDistance = maxDistance
        }
      },
      /**
       * #action
       */
      setShowYScalebar(show: boolean) {
        self.showYScalebar = show
      },
      /**
       * #action
       */
      setShowOutline(show: boolean) {
        self.showOutline = show
      },
      /**
       * #action
       */
      selectFeature(chain: ReducedFeature[]) {
        const session = getSession(self)
        const syntheticFeature = chainToSimpleFeature(chain)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'BaseFeatureWidget',
            'baseFeature',
            {
              featureData: syntheticFeature.toJSON(),
              view: getContainingView(self),
              track: getContainingTrack(self),
            },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(syntheticFeature)
      },
      /**
       * #action
       */
      setDrawCloud(b: boolean) {
        self.drawCloud = b
      },
      /**
       * #action
       * Set the ID of the selected feature for persistent highlighting
       */
      setSelectedFeatureId(id: string | undefined) {
        self.selectedFeatureId = id
      },
      /**
       * #action
       */
      setHideSmallIndels(arg: boolean) {
        self.hideSmallIndelsSetting = arg
      },
      /**
       * #action
       */
      setHideMismatches(arg: boolean) {
        self.hideMismatchesSetting = arg
      },
      /**
       * #action
       */
      setHideLargeIndels(arg: boolean) {
        self.hideLargeIndelsSetting = arg
      },

      /**
       * #action
       */
      setShowLegend(s: boolean) {
        self.showLegend = s
      },
    }))
    .views(self => ({
      /**
       * #method
       * Returns legend items based on current colorBy setting
       */
      legendItems(): LegendItem[] {
        return getReadDisplayLegendItems(
          self.colorBy,
          self.visibleModifications,
        )
      },

      /**
       * #method
       * Returns the width needed for the SVG legend if showLegend is enabled.
       * Used by SVG export to add extra width for the legend area.
       */
      svgLegendWidth(): number {
        return self.showLegend ? calculateSvgLegendWidth(this.legendItems()) : 0
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self

      return {
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
            notReady: false,
            filterBy: self.filterBy,
            colorBy: self.colorBy,
            featureHeight: self.featureHeightSetting,
            noSpacing: self.noSpacing ?? false,
            drawCloud: self.drawCloud,
            drawSingletons: self.drawSingletons,
            drawProperPairs: self.drawProperPairs,
            flipStrandLongReadChains: self.flipStrandLongReadChains,
            trackMaxHeight: self.trackMaxHeight,
            hideSmallIndels: self.hideSmallIndels,
            hideMismatches: self.hideMismatches,
            hideLargeIndels: self.hideLargeIndels,
            showOutline: self.showOutline,
            cloudDomain: self.cloudDomain,
            visibleModifications: Object.fromEntries(
              self.visibleModifications.toJSON(),
            ),
          }
        },
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Set feature height...',
              subMenu: [
                {
                  label: 'Normal',
                  type: 'radio',
                  checked:
                    self.featureHeightSetting === 7 && self.noSpacing !== true,
                  onClick: () => {
                    self.setFeatureHeight(7)
                    self.setNoSpacing(false)
                  },
                },
                {
                  label: 'Compact',
                  type: 'radio',
                  checked:
                    self.featureHeightSetting === 3 && self.noSpacing === true,
                  onClick: () => {
                    self.setFeatureHeight(3)
                    self.setNoSpacing(true)
                  },
                },
                {
                  label: 'Super-compact',
                  type: 'radio',
                  checked:
                    self.featureHeightSetting === 1 && self.noSpacing === true,
                  onClick: () => {
                    self.setFeatureHeight(1)
                    self.setNoSpacing(true)
                  },
                },
                {
                  label: 'Manually set height...',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      SetFeatureHeightDialog,
                      {
                        model: self,
                        handleClose,
                      },
                    ])
                  },
                },
              ],
            },
            {
              label: 'Show...',
              icon: VisibilityIcon,
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Show legend',
                  type: 'checkbox',
                  checked: self.showLegend,
                  onClick: () => {
                    self.setShowLegend(!self.showLegend)
                  },
                },
                {
                  label: "Show as 'read cloud' (paired-end reads)",
                  type: 'checkbox',
                  helpText:
                    'In read cloud mode, the y-coordinate of paired-end reads is proportional to insert size (TLEN). This mode is designed for paired-end short reads; long reads will appear at y=0.',
                  checked: self.drawCloud,
                  onClick: () => {
                    self.setDrawCloud(!self.drawCloud)
                  },
                },
                {
                  label: 'Show y-scalebar',
                  type: 'checkbox',
                  helpText:
                    'Show insert size scale on the y-axis (only visible in cloud mode)',
                  checked: self.showYScalebar,
                  onClick: () => {
                    self.setShowYScalebar(!self.showYScalebar)
                  },
                },
                {
                  label: 'Show read strand relative to primary',
                  helpText:
                    'This makes all the reads draw their strand relative to the primary alignment, which can be helpful in seeing patterns of flipping orientation in split long-read alignments',
                  type: 'checkbox',
                  checked: self.flipStrandLongReadChains,
                  onClick: () => {
                    self.setFlipStrandLongReadChains(
                      !self.flipStrandLongReadChains,
                    )
                  },
                },
                {
                  label: 'Show outline',
                  helpText: 'Draw an outline around each read',
                  type: 'checkbox',
                  checked: self.showOutline,
                  onClick: () => {
                    self.setShowOutline(!self.showOutline)
                  },
                },
                getMismatchDisplayMenuItem(self),
              ],
            },

            getEditFiltersMenuItem(self),
            getColorSchemeMenuItem(self),
          ]
        },

        /**
         * #method
         */
        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearReadCloudDisplayModel, opts)
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttachRPC } = await import('./afterAttachRPC.tsx')
            doAfterAttachRPC(self)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        drawCloud,
        noSpacing,
        trackMaxHeight,
        showLegend,
        showOutline,
        hideSmallIndelsSetting,
        hideMismatchesSetting,
        hideLargeIndelsSetting,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(drawCloud ? { drawCloud } : {}),
        ...(noSpacing !== undefined ? { noSpacing } : {}),
        ...(trackMaxHeight !== undefined ? { trackMaxHeight } : {}),
        ...(showLegend !== undefined ? { showLegend } : {}),
        ...(!showOutline ? { showOutline } : {}),
        ...(hideSmallIndelsSetting !== undefined
          ? { hideSmallIndelsSetting }
          : {}),
        ...(hideMismatchesSetting !== undefined
          ? { hideMismatchesSetting }
          : {}),
        ...(hideLargeIndelsSetting !== undefined
          ? { hideLargeIndelsSetting }
          : {}),
      } as typeof snap
    })
}

export type LinearReadCloudDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearReadCloudDisplayModel =
  Instance<LinearReadCloudDisplayStateModel>

export default stateModelFactory
