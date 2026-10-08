import { variantSortColumn } from '@jbrowse/alignments-core'
import {
  getContainingView,
  getSession,
  withFeatureDetails,
} from '@jbrowse/core/util'
import SortIcon from '@mui/icons-material/Sort'

import { SORT_READS_MENU_LABEL } from './labels.ts'

import type { VariantSortColumn } from '@jbrowse/alignments-core'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface SortReadsMenuSelf extends IStateTreeNode {
  contextMenuInfo?: {
    item: { featureId: string; type: string | undefined }
    displayedRegionIndex: number
  }
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
}

// The alignments display's sort action, by duck type: this plugin does not
// depend on the alignments plugin.
interface SortableDisplay {
  setSortedByAtPosition: (
    sortedBy: VariantSortColumn & { refName: string },
  ) => void
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
        typeof (d as Partial<SortableDisplay>).setSortedByAtPosition ===
        'function',
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
    display.setSortedByAtPosition({ ...column, refName })
  }
  return true
}

// One row on the variant feature menu, where the view also shows reads. The
// record is fetched because the display paints from slim arrays with no REF or
// ALT, as `breakendMenuItems` fetches it for the mate.
export function sortReadsMenuItems(self: SortReadsMenuSelf): MenuItem[] {
  const info = self.contextMenuInfo
  const view = getContainingView(self) as unknown as ViewWithTracks
  if (
    !info ||
    info.item.type === 'breakend' ||
    sortableDisplays(view).length === 0
  ) {
    return []
  }
  const { featureId } = info.item
  const { displayedRegionIndex } = info
  return [
    {
      label: SORT_READS_MENU_LABEL,
      icon: SortIcon,
      onClick: () => {
        void withFeatureDetails(
          self,
          () => self.fetchFullFeature(featureId, displayedRegionIndex),
          feature => {
            if (!sortReadsAtVariant(view, feature, displayedRegionIndex)) {
              getSession(self).notify(
                'This variant spells out no allele to sort the reads on',
                'info',
              )
            }
          },
        )
      },
    },
  ]
}
