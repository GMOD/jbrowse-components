import { getSession } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type { VariantReviewView } from '../VariantReviewViewExtension/model.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

function isReviewView(v: unknown): v is VariantReviewView {
  return (
    !!v &&
    typeof (v as Partial<VariantReviewView>).startReview === 'function' &&
    typeof (v as Partial<VariantReviewView>).gotoCandidate === 'function'
  )
}

/**
 * #stateModel VariantReviewWidget
 * The review drawer. It holds only which view it is for and reads everything
 * else off that view, so closing it loses nothing.
 */
export default function stateModelFactory() {
  return types
    .model('VariantReviewWidget', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('VariantReviewWidget'),
      /**
       * #property
       * the id of the LinearGenomeView under review
       */
      view: types.maybe(types.string),
    })
    .views(self => ({
      /**
       * #getter
       * the view, or undefined when it has closed or is not a reviewing
       * LinearGenomeView
       */
      get reviewView(): VariantReviewView | undefined {
        const v = getSession(self).views.find(v => v.id === self.view)
        return isReviewView(v) ? v : undefined
      },
      /**
       * #getter
       * the LinearGenomeViews this widget could review in, for the picker
       */
      get reviewableViews(): VariantReviewView[] {
        return getSession(self).views.flatMap(v => (isReviewView(v) ? [v] : []))
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setView(viewId: string) {
        self.view = viewId
      },
    }))
}

export type VariantReviewWidgetStateModel = ReturnType<typeof stateModelFactory>
export interface VariantReviewWidgetModel extends Instance<VariantReviewWidgetStateModel> {}
