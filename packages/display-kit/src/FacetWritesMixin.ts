import { setConf } from '@jbrowse/core/configuration'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/** A `facet` object as written. */
export interface WrittenFacet {
  field?: string
  sort?: readonly string[]
  hidden?: readonly string[]
  [member: string]: unknown
}

/** The whole of what `FacetWritesMixin` needs a composing display to be. */
export interface FacetWritesHost {
  configuration: AnyConfigurationModel & { facet: AnyConfigurationModel }
}

const host = (self: object) => self as FacetWritesHost

/**
 * The facet a pick of `field` writes over `current`: the field already
 * grouping keeps its order and hidden sections, another starts with none,
 * and `''` groups nothing. Members that are not about the sections, such as
 * the mark display's per-section `transform`, stay.
 */
export function facetForField(current: WrittenFacet, field: string) {
  if (field === (current.field ?? '')) {
    return current
  }
  const { field: _field, sort: _sort, hidden: _hidden, ...kept } = current
  return field ? { ...kept, field } : kept
}

/**
 * #stateModel FacetWritesMixin
 * #category display
 * #crossCuttingMixin The writes a display's `facet` object takes from a menu row, a dialog or a chip drag: the field the sections split by (`facetByField`) and their order (`setFacetSort`). Each rewrites the object as written, so what a pick leaves alone stays, and a pick of the field already grouping writes nothing. A display that resets its scroll when the sections change does it from `HiddenGroupsMixin`'s `dropGroupState`, which also runs for a facet an agent, a share link or "Edit plot" writes
 */
export default function FacetWritesMixin() {
  return types
    .model('FacetWritesMixin', {})
    .views(self => ({
      /**
       * #getter
       * The `facet` object as written.
       */
      get writtenFacet(): WrittenFacet {
        return (
          getSnapshot<WrittenFacet | undefined>(
            host(self).configuration.facet,
          ) ?? {}
        )
      },
    }))
    .actions(self => {
      function write(next: WrittenFacet) {
        if (!compareStructural(next, self.writtenFacet)) {
          setConf(host(self), 'facet', next)
        }
      }
      return {
        /**
         * #action
         * Split the sections by `field`, `''` for none, keeping the order and
         * hidden sections while it is the field already grouping.
         */
        facetByField(field: string) {
          write(facetForField(self.writtenFacet, field))
        },
        /**
         * #action
         * The order the sections take, the ones it names first; `[]` sorts
         * them all.
         */
        setFacetSort(sort: readonly string[]) {
          if (self.writtenFacet.field) {
            write({ ...self.writtenFacet, sort: [...sort] })
          }
        },
      }
    })
}
