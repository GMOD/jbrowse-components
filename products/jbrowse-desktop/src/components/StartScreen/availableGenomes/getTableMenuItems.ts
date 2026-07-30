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
      label: 'Show favorites only',
      checked: showOnlyFavs,
      type: 'checkbox',
      onClick: () => {
        setShowOnlyFavs(!showOnlyFavs)
      },
    },
    // The extra columns, and the NCBI status fields they filter on, exist only
    // for GenArk/NCBI assemblies; UCSC main genomes carry neither.
    ...(typeOption === 'ucsc'
      ? []
      : ([
          {
            label: 'Show all columns',
            type: 'checkbox',
            checked: showAllColumns,
            onClick: () => {
              setShowAllColumns(!showAllColumns)
            },
          },
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
        ] satisfies MenuItem[])),
    {
      label: 'Reset favorites list to defaults',
      onClick: () => {
        onResetFavorites()
      },
    },
  ]
}
