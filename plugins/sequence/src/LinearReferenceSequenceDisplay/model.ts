import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getContainingTrack, getContainingView } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

/**
 * #stateModel LinearReferenceSequenceDisplay
 * base model `BaseLinearDisplay`
 */
export function modelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReferenceSequenceDisplay',
      BaseLinearDisplay,
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
       * showReverse setting, it is NOT disabled for non-dna sequences
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
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          const {
            rpcDriverName,
            showForwardActual,
            showReverseActual,
            showTranslationActual,
            rowHeight,
            sequenceHeight,
            sequenceType,
          } = self
          return {
            ...superRenderProps(),
            ...getParentRenderProps(self),
            config: self.configuration.renderer,
            rpcDriverName,
            showForward: showForwardActual,
            showReverse: showReverseActual,
            showTranslation: showTranslationActual,
            sequenceType,
            rowHeight,
            sequenceHeight,
          }
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      regionCannotBeRendered(/* region */) {
        const view = getContainingView(self) as LGV
        return view.bpPerPx > 3 ? 'Zoom in to see sequence' : undefined
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
    .actions(self => ({
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
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            const view = getContainingView(self) as LGV
            if (view.bpPerPx > 3) {
              self.setHeight(50)
            } else {
              self.setHeight(self.sequenceHeight)
            }
          }),
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
}
