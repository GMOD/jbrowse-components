import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  dedupe,
  getContainingTrack,
  getContainingView,
  getSession,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { TrackHeightMixin } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import type React from 'react'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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
  DisplayMessageComponent: React.LazyExoticComponent<React.ComponentType<{ model: LinearReferenceSequenceDisplayModel }>>
  configuration: Record<string, unknown>
}

const WebGLSequenceComponent = lazy(
  () => import('./components/WebGLSequenceComponent.tsx'),
)

/**
 * #stateModel LinearReferenceSequenceDisplay
 * base model `BaseDisplay` + `TrackHeightMixin`
 */
export function modelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReferenceSequenceDisplay',
      BaseDisplay,
      TrackHeightMixin(),
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
      /**
       * #property
       */
      rowHeight: 15,
      sequenceData: new Map<number, SequenceRegionData>(),
      error: undefined as unknown,
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
       */
      get sequenceHeight() {
        const {
          rowHeight,
          showTranslationActual,
          showReverseActual,
          showForwardActual,
        } = self
        const r1 =
          showReverseActual && showTranslationActual ? rowHeight * 3 : 0
        const r2 =
          showForwardActual && showTranslationActual ? rowHeight * 3 : 0
        const t = r1 + r2
        const r = showReverseActual ? rowHeight : 0
        const s = showForwardActual ? rowHeight : 0
        return t + r + s
      },
    }))
    .views(() => ({
      get DisplayMessageComponent() {
        return WebGLSequenceComponent
      },
    }))
    .actions(self => ({
      setSequenceData(data: Map<number, SequenceRegionData>) {
        self.sequenceData = data
      },
      setError(err: unknown) {
        self.error = err
      },
      /**
       * #action
       */
      toggleShowForward() {
        self.showForward = !self.showForward
      },
      /**
       * #action
       */
      toggleShowReverse() {
        self.showReverse = !self.showReverse
      },
      /**
       * #action
       */
      toggleShowTranslation() {
        self.showTranslation = !self.showTranslation
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function sequenceHeightAutorun() {
              const view = getContainingView(self) as LGV
              if (!view.initialized || view.bpPerPx > 3) {
                self.setHeight(50)
              } else {
                self.setHeight(self.sequenceHeight)
              }
            },
            { name: 'SequenceHeight' },
          ),
        )

        makeAbortableReaction(
          self,
          () => {
            const view = getContainingView(self) as LGV
            if (!view.initialized || view.bpPerPx > 3) {
              return undefined
            }
            return {
              adapterConfig: self.adapterConfig,
              regions: view.staticRegions,
              sessionId: getRpcSessionId(self),
            }
          },
          async args => {
            if (!args) {
              return undefined
            }
            const { rpcManager } = getSession(self)
            const { adapterConfig, regions, sessionId } = args
            const result = new Map<number, SequenceRegionData>()

            for (const region of regions) {
              const rawFeatures = (await rpcManager.call(
                sessionId,
                'CoreGetFeatures',
                {
                  regions: [region],
                  sessionId,
                  adapterConfig,
                },
              )) as Feature[]
              const features = dedupe(rawFeatures, f => f.id())

              for (const f of features) {
                const seq = f.get('seq') as string | undefined
                if (seq) {
                  result.set(region.regionNumber, {
                    seq,
                    start: f.get('start'),
                    end: f.get('end'),
                  })
                }
              }
            }
            return result
          },
          {
            name: `${self.type} ${self.id} sequence loading`,
            delay: 300,
            fireImmediately: true,
          },
          () => {},
          result => {
            if (result) {
              self.setSequenceData(result)
            }
          },
          err => {
            self.setError(err)
          },
        )
      },
    }))
    .views(self => ({
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
