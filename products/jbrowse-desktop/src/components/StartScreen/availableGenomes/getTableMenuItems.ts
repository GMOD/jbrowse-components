import defaultFavs from '../defaultFavs.ts'

import type { FilterOption } from './useGenomesData.ts'
import type { Fav } from '../types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

export function getTableMenuItems({
  typeOption,
  multipleSelection,
  showOnlyFavs,
  showAllColumns,
  filterOption,
  setMultipleSelection,
  setSelected,
  setShowOnlyFavs,
  setShowAllColumns,
  setPageIndex,
  setFilterOptionAndReset,
  setFavorites,
}: {
  typeOption: string
  multipleSelection: boolean
  showOnlyFavs: boolean
  showAllColumns: boolean
  filterOption: FilterOption
  setMultipleSelection: (arg: boolean) => void
  setSelected: (arg: Set<string>) => void
  setShowOnlyFavs: (arg: boolean) => void
  setShowAllColumns: (arg: boolean) => void
  setPageIndex: (arg: number) => void
  setFilterOptionAndReset: (arg: FilterOption) => void
  setFavorites: (arg: Fav[]) => void
}): MenuItem[] {
  return [
    {
      label: 'Enable multiple selection',
      checked: multipleSelection,
      type: 'checkbox',
      onClick: () => {
        setMultipleSelection(!multipleSelection)
        setSelected(new Set())
      },
    },
    {
      label: 'Show favorites only?',
      checked: showOnlyFavs,
      type: 'checkbox',
      onClick: () => {
        setShowOnlyFavs(!showOnlyFavs)
        setPageIndex(0)
      },
    },
    ...(typeOption !== 'ucsc'
      ? ([
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
            subMenu: [
              {
                label: 'All',
                type: 'radio',
                checked: filterOption === 'all',
                onClick: () => {
                  setFilterOptionAndReset('all')
                },
              },
              {
                label: 'RefSeq only',
                type: 'radio',
                checked: filterOption === 'refseq',
                onClick: () => {
                  setFilterOptionAndReset('refseq')
                },
              },
              {
                label: 'GenBank only',
                type: 'radio',
                checked: filterOption === 'genbank',
                onClick: () => {
                  setFilterOptionAndReset('genbank')
                },
              },
              {
                label: 'Designated reference genome only',
                type: 'radio',
                checked: filterOption === 'designatedReference',
                onClick: () => {
                  setFilterOptionAndReset('designatedReference')
                },
              },
            ],
          },
        ] satisfies MenuItem[])
      : []),
    {
      label: 'Reset favorites list to defaults',
      onClick: () => {
        setFavorites(defaultFavs)
      },
    },
  ]
}
