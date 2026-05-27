import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { installPerRegionLifecycle } from '@jbrowse/core/gpu/installPerRegionLifecycle'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { computeYTicks, makeScaleTypeSubMenu } from '@jbrowse/wiggle-core'
import PaletteIcon from '@mui/icons-material/Palette'

import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import { makeWigglePreProcessSnapshot } from '../shared/makeWigglePreProcessSnapshot.ts'
import { rendererMenuItems } from '../shared/rendererMenuItems.ts'
import { makeRenderState } from '../shared/wiggleComponentUtils.ts'
import { makeResolutionAndSummarySubMenus } from '../shared/wiggleMenuItems.ts'
import {
  SINGLE_WIGGLE_SOURCE_NAME,
  YSCALEBAR_LABEL_OFFSET,
  isDefaultBicolor,
} from '../util.ts'

import type { WiggleDataResult } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { WiggleBackend } from '@jbrowse/wiggle-core'

export type { Region } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

const WiggleComponent = lazy(() => import('./components/WiggleComponent.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

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
        type: types.literal('LinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .preProcessSnapshot(
      // @ts-expect-error - MST's preProcessSnapshot typing can't verify the
      // return type against the model creation type
      makeWigglePreProcessSnapshot(),
    )
    .volatile(() => ({
      featureUnderMouse: undefined as
        | {
            refName: string
            start: number
            end: number
            score: number
            minScore?: number
            maxScore?: number
            summary?: boolean
          }
        | undefined,
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return WiggleComponent
      },

      get color() {
        return self.getConfWithOverride<string>('color')
      },

      get isDensityMode() {
        return self.renderingType === 'density'
      },
    }))
    .views(self => ({
      // Sent to the worker as `bicolorPivot`. When the user picked a custom
      // color we set the pivot to -Infinity so `score >= pivot` is always
      // true and every feature lands in the worker's pos arrays — the
      // display then paints that single bucket with the user's chosen color.
      // Default (`#f0f`) color keeps the configured pivot for the standard
      // pos/neg split.
      get effectiveBicolorPivot() {
        return isDefaultBicolor(self.color) ? self.bicolorPivot : -Infinity
      },
    }))
    .views(self => ({
      get ticks() {
        return computeYTicks({
          height: self.height,
          domain: self.domain,
          scaleType: self.scaleType,
          minimalTicks: self.getConfWithOverride<boolean>('minimalTicks'),
        })
      },

      get renderState() {
        const view = getContainingView(self) as LGV
        const width = view.trackWidthPx
        const height = self.height - 2 * YSCALEBAR_LABEL_OFFSET
        const domain = self.domain
        if (domain) {
          return makeRenderState(
            domain,
            self.scaleType,
            self.renderingType,
            width,
            height,
          )
        }
        // No domain means either (a) no fetch has completed yet — keep
        // undefined so the loading overlay stays, or (b) fetch completed
        // with zero features — return a stub state so renderBlocks runs,
        // clears the canvas, and canvasDrawn flips. Domain is arbitrary
        // since no features will draw.
        if (self.rpcDataMap.size === 0) {
          return undefined
        }
        return makeRenderState(
          [0, 1],
          self.scaleType,
          self.renderingType,
          width,
          height,
        )
      },

      rpcProps() {
        return {
          bicolorPivot: self.effectiveBicolorPivot,
          resolution: self.resolution,
        }
      },

      // single-source gpuProps mapped onto the multi-source build path:
      // - useBicolor (default color): no source override, multi build emits
      //   pos+neg arrays with their respective colors
      // - !useBicolor (custom solid color): worker put all features in pos
      //   arrays (effectiveBicolorPivot=-Infinity); whiskers and non-density
      //   modes want the user's solid color, density wants posColor (which
      //   is the multi build default already, so leave undefined)
      gpuProps() {
        const useBicolor = isDefaultBicolor(self.color)
        const wantsSolidColor =
          !useBicolor &&
          (self.summaryScoreMode === 'whiskers' || !self.isDensityMode)
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
      setRpcData(displayedRegionIndex: number, data: WiggleDataResult) {
        self.rpcDataMap.set(displayedRegionIndex, data)
      },

      setPosColor(color?: string) {
        self.setOverride('posColor', color)
      },

      setNegColor(color?: string) {
        self.setOverride('negColor', color)
      },

      setFeatureUnderMouse(feat?: typeof self.featureUnderMouse) {
        self.featureUnderMouse = feat
      },
    }))
    .actions(self => ({
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        const view = getContainingView(self) as LGV
        const { adapterConfig } = self
        if (!adapterConfig) {
          return
        }
        const { bpPerPx } = view
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        await self.fetchRegions(needed, async (ctx: FetchContext) => {
          await Promise.all(
            needed.map(async r => {
              const result = await rpcManager.call(
                sessionId,
                'RenderWiggleData',
                {
                  sessionId,
                  adapterConfig,
                  region: r.region,
                  ...self.rpcProps(),
                  stopToken: ctx.stopToken,
                  bpPerPx,
                  statusCallback: (msg: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(msg)
                    }
                  },
                },
              )
              if (!ctx.isStale()) {
                self.setRpcData(r.displayedRegionIndex, result)
              }
            }),
          )
          if (!ctx.isStale()) {
            self.setLoadedBpPerPx(bpPerPx)
          }
        })
      },
    }))
    .views(self => ({
      trackMenuItems() {
        return [
          {
            label: 'Rendering type',
            subMenu: (
              [
                ['xyplot', 'XY plot'],
                ['density', 'Density'],
                ['line', 'Line'],
                ['scatter', 'Scatter'],
              ] as const
            ).map(([value, label]) => ({
              label,
              type: 'radio' as const,
              checked: self.renderingType === value,
              onClick: () => {
                self.setRenderingType(value)
              },
            })),
          },
          ...makeResolutionAndSummarySubMenus(self),
          // Inject the wiggle-only scale type into the shared Score submenu.
          ...rendererMenuItems(self, {
            extraScoreItems: [makeScaleTypeSubMenu(self)],
          }),
          {
            label: 'Color',
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
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearWiggleDisplayModel, opts)
      },
      startBackend(backend: WiggleBackend) {
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
