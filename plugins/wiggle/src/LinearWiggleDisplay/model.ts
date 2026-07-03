import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchAllRegions,
} from '@jbrowse/plugin-linear-genome-view'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  computeYTicks,
  makeCrossHatchItem,
  makeScoreSubMenu,
  resolveRenderState,
} from '@jbrowse/wiggle-core'
import PaletteIcon from '@mui/icons-material/Palette'

import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import {
  makeRenderState,
  wiggleFeatureWidgetData,
} from '../shared/wiggleComponentUtils.ts'
import {
  makePointSizeMenuItems,
  makeRenderingTypeSubMenu,
  makeResolutionAndSummarySubMenus,
  makeShowSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import {
  SINGLE_WIGGLE_SOURCE_NAME,
  WIGGLE_RENDERINGS,
  YSCALEBAR_LABEL_OFFSET,
} from '../util.ts'

import type { WiggleDataResult, WiggleFeatureUnderMouse } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { WiggleRenderingBackend } from '@jbrowse/wiggle-core'

export type { Region } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

const WiggleComponent = lazy(() => import('./components/WiggleComponent.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

/**
 * #stateModel LinearWiggleDisplay
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
  configSchema: AnyConfigurationSchemaType,
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
    .volatile(() => ({
      /**
       * #volatile
       */
      featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get DisplayMessageComponent() {
        return WiggleComponent
      },

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
       */
      get renderState() {
        const view = getContainingView(self) as LGV
        const width = view.trackWidthPx
        const height = self.height - 2 * YSCALEBAR_LABEL_OFFSET
        return resolveRenderState(
          self.domain,
          self.rpcDataMap.size > 0,
          domain =>
            makeRenderState(
              domain,
              self.scaleType,
              self.renderingType,
              width,
              height,
              1,
              self.scatterPointSize,
            ),
        )
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
          negColor: self.negColor,
          summaryScoreMode: self.summaryScoreMode,
          isDensityMode: self.isDensityMode,
          renderingType: self.renderingType,
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
        self.configuration.setSlot('useBicolor', val)
      },

      /**
       * #action
       */
      setColor(color?: string) {
        self.configuration.setSlot('color', color)
      },

      /**
       * #action
       */
      setPosColor(color?: string) {
        self.configuration.setSlot('posColor', color)
      },

      /**
       * #action
       */
      setNegColor(color?: string) {
        self.configuration.setSlot('negColor', color)
      },

      /**
       * #action
       */
      setFeatureUnderMouse(feat?: typeof self.featureUnderMouse) {
        self.featureUnderMouse = feat
      },

      /**
       * #action
       */
      selectFeature(feat: NonNullable<typeof self.featureUnderMouse>) {
        openFeatureWidget(self, wiggleFeatureWidgetData(feat))
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        const view = getContainingView(self) as LGV
        const { adapterConfig } = self
        if (adapterConfig) {
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
                statusCallback: self.makeRegionStatusCallback(
                  needed[0]!.displayedRegionIndex,
                ),
              }),
            onResult: (idx, result) => {
              self.setRpcData(idx, result)
            },
            onComplete: () => {
              self.setLoadedBpPerPx(bpPerPx)
            },
          })
        }
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems() {
        return [
          makeRenderingTypeSubMenu(self, WIGGLE_RENDERINGS),
          ...makePointSizeMenuItems(self),
          // scaleType: true keeps the scale-type submenu (manhattan, linear-only,
          // drops it); resolution/summary lead the submenu, matching multi-wiggle.
          makeScoreSubMenu(self, {
            scaleType: true,
            leadingItems: makeResolutionAndSummarySubMenus(self),
          }),
          // cross hatches are meaningless in density mode (score maps to color,
          // not height)
          ...makeShowSubMenu(
            self.isDensityMode ? [] : [makeCrossHatchItem(self)],
          ),
          {
            label: 'Edit color...',
            icon: PaletteIcon,
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
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          data => buildSourceRenderData(data, self.gpuProps()),
          (b, encoded) => {
            const state = self.renderState
            if (!state) {
              return false
            }
            b.renderBlocks(self.renderBlocks, encoded, state)
            return true
          },
        )
      },
    }))
}

export type LinearWiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearWiggleDisplayModel = Instance<LinearWiggleDisplayStateModel>
