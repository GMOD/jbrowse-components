import { keyedBase, setConf } from '@jbrowse/core/configuration'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { SECTION_FACET_WRITES } from './sectionFacetConfigSchema.ts'

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
  configuration: FacetOwner
}

/**
 * A config node holding a `facet` object: a display's own configuration, or a
 * band's within it, such as the variant display's `records`.
 */
export type FacetOwner = AnyConfigurationModel & {
  facet: AnyConfigurationModel
}

const host = (self: object) => self as FacetWritesHost

/** `owner`'s `facet` object as written. */
export function writtenFacetOf(owner: FacetOwner): WrittenFacet {
  return getSnapshot<WrittenFacet | undefined>(owner.facet) ?? {}
}

function writeFacet(owner: FacetOwner, next: WrittenFacet) {
  if (!compareStructural(next, writtenFacetOf(owner))) {
    setConf(owner, 'facet', next)
  }
}

/**
 * `FacetWritesMixin`'s `facetByField` over `owner`'s facet: split by
 * `field`, keeping the order and hidden sections while it is the field
 * already grouping, and writing nothing where the pick already holds.
 */
export function facetByFieldOn(owner: FacetOwner, field: string) {
  writeFacet(owner, facetForField(writtenFacetOf(owner), field))
}

/**
 * `FacetWritesMixin`'s `setFacetSort` over `owner`'s facet: the order its
 * sections take, written only while a field splits them.
 */
export function setFacetSortOn(owner: FacetOwner, sort: readonly string[]) {
  const written = writtenFacetOf(owner)
  if (written.field) {
    writeFacet(owner, { ...written, sort: [...sort] })
  }
}

/**
 * The facet a pick of `field` writes over `current`, by the keyed rule
 * (ADR-257): the field already grouping keeps its order and hidden sections,
 * another starts with none, and `''` groups nothing. Members that are not
 * about the sections, such as the mark display's per-section `transform`,
 * stay.
 */
export function facetForField(current: WrittenFacet, field: string) {
  const { field: _field, sort: _sort, hidden: _hidden, ...kept } = current
  return field === (current.field ?? '')
    ? current
    : field
      ? { ...keyedBase(SECTION_FACET_WRITES, current, { field }), field }
      : kept
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
        return writtenFacetOf(host(self).configuration)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Split the sections by `field`, `''` for none, keeping the order and
       * hidden sections while it is the field already grouping.
       */
      facetByField(field: string) {
        facetByFieldOn(host(self).configuration, field)
      },
      /**
       * #action
       * The order the sections take, the ones it names first; `[]` sorts
       * them all.
       */
      setFacetSort(sort: readonly string[]) {
        setFacetSortOn(host(self).configuration, sort)
      },
    }))
}
