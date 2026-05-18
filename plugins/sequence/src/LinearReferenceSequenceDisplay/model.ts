import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  dedupe,
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { observable } from 'mobx'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Region } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const ZOOMED_OUT_BP_PER_PX = 10

export interface SequenceRegionData {
  seq: string
  start: number
  end: number
}

export interface LinearReferenceSequenceDisplayModel {
  height: number
  sequenceData: ReadonlyMap<number, SequenceRegionData>
  renderBlocks: RenderBlock[]
  error: unknown
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
  isDna: boolean
  sequenceType: string
  rowHeight: number
  sequenceHeight: number
  showLoading: boolean
  zoomedOut: boolean
  clearAllRpcData: () => void
}

/**
 * #stateModel LinearReferenceSequenceDisplay
 * base model `BaseDisplay` + `TrackHeightMixin` + `MultiRegionDisplayMixin`
 */
export function modelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReferenceSequenceDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearReferenceSequenceDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        showForward: true,
        /**
         * #property
         */
        showReverse: true,
        /**
         * #property
         */
        showTranslation: true,
      }),
    )
    .volatile(() => ({
      sequenceData: observable.map<number, SequenceRegionData>(),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get sequenceType() {
        return getConf(getContainingTrack(self), 'sequenceType')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * true for DNA tracks; reverse-complement and translation rows are
       * gated on this since they are biologically meaningful only for DNA.
       */
      get isDna() {
        return self.sequenceType === 'dna'
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the view is too zoomed out to show individual bases
       */
      get zoomedOut() {
        const view = getContainingView(self) as LGV
        return view.bpPerPx > ZOOMED_OUT_BP_PER_PX
      },
      get numRows() {
        const f = self.showForward ? 1 : 0
        const r = self.isDna && self.showReverse ? 1 : 0
        const t = self.isDna && self.showTranslation ? 1 : 0
        return f + r + 3 * t * (f + r)
      },
      get sequenceHeight() {
        return this.numRows * 15
      },
      get showLoading() {
        return self.sequenceData.size === 0 || self.isLoading
      },
      /**
       * #getter
       * collapses to 50px when zoomed out (no sequence visible) or before
       * the view initializes; otherwise sized to fit the visible rows.
       */
      get computedHeight() {
        return this.zoomedOut ? 50 : this.sequenceHeight
      },
      /**
       * #getter
       * override TrackHeightMixin height: use manual resize if set,
       * otherwise the zoom-aware computed height.
       */
      get height() {
        return self.heightPreConfig ?? this.computedHeight
      },
      get rowHeight() {
        return this.numRows > 0 ? this.height / this.numRows : 0
      },
    }))
    .actions(self => ({
      setSequenceRegion(idx: number, data: SequenceRegionData) {
        self.sequenceData.set(idx, data)
      },
      clearDisplaySpecificData() {
        self.sequenceData.clear()
      },
      /**
       * #action
       */
      toggleShowForward() {
        self.showForward = !self.showForward
        self.heightPreConfig = undefined
      },
      /**
       * #action
       */
      toggleShowReverse() {
        self.showReverse = !self.showReverse
        self.heightPreConfig = undefined
      },
      /**
       * #action
       */
      toggleShowTranslation() {
        self.showTranslation = !self.showTranslation
        self.heightPreConfig = undefined
      },
    }))
    .actions(self => ({
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        if (self.zoomedOut) {
          return
        }
        await self.fetchRegions(needed, async ctx => {
          const { rpcManager } = getSession(self)
          const sessionId = getRpcSessionId(self)
          const adapterConfig = self.adapterConfig
          for (const { region, displayedRegionIndex } of needed) {
            const features = await rpcManager.call(
              sessionId,
              'CoreGetFeatures',
              { regions: [region], adapterConfig, stopToken: ctx.stopToken },
            )
            if (ctx.isStale()) {
              return
            }
            for (const f of dedupe(features, f => f.id())) {
              const seq = f.get('seq') as string | undefined
              if (seq) {
                self.setSequenceRegion(displayedRegionIndex, {
                  seq,
                  start: f.get('start'),
                  end: f.get('end'),
                })
              }
            }
          }
        })
      },
    }))
    .views(self => ({
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
      /**
       * #method
       */
      trackMenuItems() {
        return self.isDna
          ? [
              {
                label: 'Show forward',
                type: 'checkbox',
                checked: self.showForward,
                onClick: () => {
                  self.toggleShowForward()
                },
              },
              {
                label: 'Show reverse',
                type: 'checkbox',
                checked: self.showReverse,
                onClick: () => {
                  self.toggleShowReverse()
                },
              },
              {
                label: 'Show translation',
                type: 'checkbox',
                checked: self.showTranslation,
                onClick: () => {
                  self.toggleShowTranslation()
                },
              },
            ]
          : []
      },
    }))
    .postProcessSnapshot(snap => {
      const { showForward, showReverse, showTranslation, ...rest } =
        snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(showForward ? {} : { showForward }),
        ...(showReverse ? {} : { showReverse }),
        ...(showTranslation ? {} : { showTranslation }),
      } as typeof snap
    })
}
