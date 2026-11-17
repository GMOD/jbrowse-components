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
}: {
  state: GenomesTableState
  typeOption: string
}): MenuItem[] {
  const {
    multipleSelection,
    setMultipleSelection,
    showAllColumns,
    setShowAllColumns,
    filterOption,
    setFilterOption,
    searchQuery,
  } = state

  return [
    {
      label: 'Enable multiple selection',
      checked: multipleSelection,
      type: 'checkbox',
      onClick: () => {
        setMultipleSelection(!multipleSelection)
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
    ...(ncbiFilterApplies(typeOption, searchQuery)
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
  ]
}
