import type { WrittenFacet } from './FacetWritesMixin.ts'
import type { SectionsDialogModel } from './SectionsDialog.tsx'

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
