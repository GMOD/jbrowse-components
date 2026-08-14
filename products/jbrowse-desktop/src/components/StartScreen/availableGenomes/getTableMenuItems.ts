import { ncbiFilterApplies } from './useGenomesData.ts'

import type { FilterOption } from './useGenomesData.ts'
import type { GenomesTableState } from './useGenomesTableState.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const NCBI_FILTERS: { label: string; value: FilterOption }[] = [
  { label: 'All', value: 'all' },
  { label: 'RefSeq only', value: 'refseq' },
  { label: 'GenBank only', value: 'genbank' },
  { label: 'Designated reference genome only', value: 'designatedReference' },
]

export function getTableMenuItems({
  state,
  typeOption,
  onResetFavorites,
}: {
  state: GenomesTableState
  typeOption: string
  onResetFavorites: () => void
}): MenuItem[] {
  const {
    multipleSelection,
    setMultipleSelection,
    showOnlyFavs,
    setShowOnlyFavs,
    showAllColumns,
    setShowAllColumns,
    filterOption,
    setFilterOption,
    allGroups,
    setAllGroups,
  } = state

  return [
    {
      label: 'Search all groups',
      helpText:
        'Search every group at once instead of only the selected one, using a prebuilt index of all ~50k assemblies',
      checked: allGroups,
      type: 'checkbox',
      onClick: () => {
        setAllGroups(!allGroups)
      },
    },
    {
      label: 'Enable multiple selection',
      checked: multipleSelection,
      type: 'checkbox',
      onClick: () => {
        setMultipleSelection(!multipleSelection)
      },
    },
    {
      label: 'Show favorites only',
      checked: showOnlyFavs,
      type: 'checkbox',
      onClick: () => {
        setShowOnlyFavs(!showOnlyFavs)
      },
    },
    {
      label: 'Show all columns',
      type: 'checkbox',
      checked: showAllColumns,
      onClick: () => {
        setShowAllColumns(!showAllColumns)
      },
    },
    // offered exactly where it applies, which is also exactly where it is
    // applied — see ncbiFilterApplies
    ...(ncbiFilterApplies(typeOption, allGroups)
      ? ([
          {
            label: 'Filter by NCBI status',
            type: 'subMenu',
            subMenu: NCBI_FILTERS.map(({ label, value }) => ({
              label,
              type: 'radio',
              checked: filterOption === value,
              onClick: () => {
                setFilterOption(value)
              },
            })),
          },
        ] satisfies MenuItem[])
      : []),
    {
      label: 'Reset favorites list to defaults',
      onClick: () => {
        onResetFavorites()
      },
    },
  ]
}
