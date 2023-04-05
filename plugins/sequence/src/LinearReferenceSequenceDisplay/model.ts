import { addDisposer, types } from 'mobx-state-tree'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { autorun } from 'mobx'

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
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          const { showForward, rpcDriverName, showReverse, showTranslation } =
            self
          return {
            ...superRenderProps(),
            config: self.configuration.renderer,
            rpcDriverName,
            showForward,
            showReverse,
            showTranslation,
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
        return view?.bpPerPx >= 1 ? 'Zoom in to see sequence' : undefined
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
            if (view?.bpPerPx >= 1) {
              self.setHeight(50)
            } else {
              const { showTranslation, showReverse, showForward } = self
              const r1 = showReverse && showTranslation ? 60 : 0
              const r2 = showForward && showTranslation ? 60 : 0
              const t = r1 + r2
              const r = showReverse ? 20 : 0
              const s = showForward ? 20 : 0
              self.setHeight(t + r + s)
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
          {
            label: 'Show forward',
            type: 'checkbox',
            checked: self.showForward,
            onClick: () => self.toggleShowForward(),
          },
          {
            label: 'Show reverse',
            type: 'checkbox',
            checked: self.showReverse,
            onClick: () => self.toggleShowReverse(),
          },
          {
            label: 'Show translation',
            type: 'checkbox',
            checked: self.showTranslation,
            onClick: () => self.toggleShowTranslation(),
          },
        ]
      },
    }))
}
