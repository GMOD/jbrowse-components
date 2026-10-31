import { variantSortColumn } from '@jbrowse/alignments-core'
import { getContainingView, getSession } from '@jbrowse/core/util'
import SortIcon from '@mui/icons-material/Sort'

import { SORT_READS_MENU_LABEL } from './labels.ts'

import type { VariantSortColumn } from '@jbrowse/alignments-core'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// The alignments display's sort actions, by duck type: this plugin does not
// depend on the alignments plugin. `sortAtCenterLine` is asked for too, since
// `setSort` alone is a generic name.
interface SortableDisplay {
  setSort: (sort: VariantSortColumn & { refName: string }) => void
  sortAtCenterLine: unknown
}

interface ViewWithTracks {
  tracks: { displays: unknown[] }[]
  displayedRegions: { refName: string }[]
}

function sortableDisplays(view: ViewWithTracks) {
  return view.tracks
    .flatMap(track => track.displays)
    .filter(
      (d): d is SortableDisplay =>
        typeof (d as Partial<SortableDisplay>).setSort === 'function' &&
        typeof (d as Partial<SortableDisplay>).sortAtCenterLine === 'function',
    )
}

/**
 * Sort every pileup in the view at a variant's column, under the view's own
 * name for the contig. False where the record spells out no allele to sort on.
 */
export function sortReadsAtVariant(
  view: ViewWithTracks,
  feature: Feature,
  displayedRegionIndex: number,
) {
  const column = variantSortColumn(
    feature.get('start'),
    String(feature.get('REF') ?? ''),
    (feature.get('ALT') as string[] | undefined) ?? [],
  )
  const refName = view.displayedRegions[displayedRegionIndex]?.refName
  if (!column || refName === undefined) {
    return false
  }
  for (const display of sortableDisplays(view)) {
    display.setSort({ ...column, refName })
  }
  return true
}

// One row on the variant menu, where the view also shows reads. The
// right-clicked record carries its REF and ALT off the cell payload, so the
// sort needs no fetch.
export function sortReadsMenuItems(
  self: IStateTreeNode,
  feature: Feature,
  displayedRegionIndex: number,
): MenuItem[] {
  const view = getContainingView(self) as unknown as ViewWithTracks
  return feature.get('type') === 'breakend' ||
    sortableDisplays(view).length === 0
    ? []
    : [
        {
          label: SORT_READS_MENU_LABEL,
          icon: SortIcon,
          onClick: () => {
            if (!sortReadsAtVariant(view, feature, displayedRegionIndex)) {
              getSession(self).notify(
                'This variant spells out no allele to sort the reads on',
                'info',
              )
            }
          },
        },
      ]
}
