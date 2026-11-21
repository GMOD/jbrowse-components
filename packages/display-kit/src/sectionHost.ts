import type { WrittenFacet } from './FacetWritesMixin.ts'
import type { SectionsDialogModel } from './SectionsDialog.tsx'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'
import type { GroupId } from '@jbrowse/core/util/groupKeys'

/**
 * A stack of sections a reader hides, restores and reorders: what its chips
 * (`GroupLabelChips`' `host`), its "Sections..." dialog and its menus act on. A
 * display composing `FacetWritesMixin` and `HiddenGroupsMixin` beside a
 * `knownSections` and a `sectionsHeading` is one; a band whose sections are
 * not its display's own, such as the variant records', builds one.
 */
export interface SectionHost extends SectionsDialogModel {
  writtenFacet: WrittenFacet
  setFacetSort: (sort: readonly string[]) => void
  hideGroup: (key: string) => void
  showAllGroups: () => void
}

/**
 * The order a reorder or "Reset section order" rewrites: the facet's `sort`,
 * while a field splits the sections.
 */
export function sectionSortOf(host: SectionHost) {
  const { field, sort = [] } = host.writtenFacet
  return field
    ? {
        domain: sort,
        setDomain: (domain: readonly string[]) => {
          host.setFacetSort(domain)
        },
      }
    : undefined
}

/**
 * Every section a grouped stack can name, for its Sections dialog: each key
 * its data holds (`keysSeen`), hidden or not, and each `known` key besides,
 * the facet's `sort` and hidden ones among them, so a section absent from
 * this window still lists. In `field`'s order, labelled by its value.
 */
export function knownSectionsOf(
  keysSeen: Iterable<string>,
  field: Pick<CategoricalField, 'compare' | 'label'>,
  known: Iterable<string>,
): GroupId[] {
  const keys = new Set(known)
  for (const key of keysSeen) {
    keys.add(key)
  }
  return [...keys]
    .sort((a, b) => field.compare(a, b))
    .map(key => ({ key, label: field.label(key) }))
}
