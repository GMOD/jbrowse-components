import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import { getColorForModification } from '../util.ts'

import type { ModificationType, ModificationTypeWithColor } from './types.ts'

/**
 * Shared mixin for modification-related state and actions.
 * Used by both LinearPileupDisplay and LinearSNPCoverageDisplay.
 */
export function SharedModificationsMixin() {
  return types
    .model({})
    .volatile(() => ({
      /**
       * #volatile
       */
      visibleModifications: observable.map<string, ModificationTypeWithColor>(
        {},
      ),
      /**
       * #volatile
       */
      simplexModifications: new Set<string>(),
      /**
       * #volatile
       */
      modificationsReady: false,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleModificationTypes() {
        return [...self.visibleModifications.keys()]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      updateVisibleModifications(uniqueModifications: ModificationType[]) {
        for (const modification of uniqueModifications) {
          if (!self.visibleModifications.has(modification.type)) {
            self.visibleModifications.set(modification.type, {
              ...modification,
              color: getColorForModification(modification.type),
            })
          }
        }
      },
      /**
       * #action
       */
      setSimplexModifications(simplex: string[]) {
        const currentSet = self.simplexModifications
        if (
          simplex.length === currentSet.size &&
          simplex.every(s => currentSet.has(s))
        ) {
          return
        }
        self.simplexModifications = new Set(simplex)
      },
      /**
       * #action
       */
      setModificationsReady(flag: boolean) {
        self.modificationsReady = flag
      },
    }))
}
