import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  dedupe,
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
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
  sequenceData: Map<number, SequenceRegionData>
  error: unknown
  showForwardActual: boolean
  showReverseActual: boolean
  showTranslationActual: boolean
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
      sequenceData: new Map<number, SequenceRegionData>(),
      computedHeight: 50,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get sequenceType() {
        return getConf(getContainingTrack(self), 'sequenceType')
      },

      /**
       * #getter
       */
      get showForwardActual() {
        return self.showForward
      },

      /**
       * #getter
       * showReverse setting, is disabled for non-dna sequences
       */
      get showReverseActual() {
        return this.sequenceType === 'dna' ? self.showReverse : false
      },

      /**
       * #getter
       * showTranslation setting is disabled for non-dna sequences
       */
      get showTranslationActual() {
        return this.sequenceType === 'dna' ? self.showTranslation : false
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
        const { showTranslationActual, showReverseActual, showForwardActual } =
          self
        let n = 0
        if (showForwardActual) {
          n++
        }
        if (showReverseActual) {
          n++
        }
        if (showForwardActual && showTranslationActual) {
          n += 3
        }
        if (showReverseActual && showTranslationActual) {
          n += 3
        }
        return n
      },
      get sequenceHeight() {
        return this.numRows * 15
      },
      get showLoading() {
        return self.sequenceData.size === 0 || self.isLoading
      },
      /**
       * #getter
       * override TrackHeightMixin height: use manual resize if set,
       * otherwise use autorun-computed height
       */
      get height() {
        return self.heightPreConfig ?? self.computedHeight
      },
      get rowHeight() {
        return this.numRows > 0 ? this.height / this.numRows : 0
      },
    }))
    .actions(self => ({
      setComputedHeight(h: number) {
        self.computedHeight = h
      },
      setSequenceRegion(idx: number, data: SequenceRegionData) {
        self.sequenceData = new Map(self.sequenceData).set(idx, data)
      },
      clearDisplaySpecificData() {
        self.sequenceData = new Map()
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
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function sequenceHeightAutorun() {
              const view = getContainingView(self) as LGV
              if (!view.initialized || self.zoomedOut) {
                self.setComputedHeight(50)
              } else {
                self.setComputedHeight(self.sequenceHeight)
              }
            },
            { name: 'SequenceHeight' },
          ),
        )
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
        return [
          ...(self.sequenceType === 'dna'
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
            : []),
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { showForward, showReverse, showTranslation, ...rest } =
        snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(!showForward ? { showForward } : {}),
        ...(!showReverse ? { showReverse } : {}),
        ...(!showTranslation ? { showTranslation } : {}),
      } as typeof snap
    })
}
