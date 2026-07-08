import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import FilterAltIcon from '@mui/icons-material/FilterAlt'

import { checkboxItem } from './menuHelpers.ts'

import type { FilterBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void
}

interface FiltersMenuOptions {
  // SAM-flag read-category filters. Passed explicitly by the alignments display;
  // omitted by synteny, which inherits the fields from the base model but has no
  // paired-end flags for them to mean anything. When present the item becomes a
  // "Filter by..." hub; when omitted it stays a single "Edit filters..." action.
  pairFilters?: {
    drawProperPairs: boolean
    setDrawProperPairs: (v: boolean) => void
    drawSingletons: boolean
    setDrawSingletons: (v: boolean) => void
  }
}

// One home for "which reads are shown": the read-name/tag/flag dialog plus the
// two read-category filters (hide proper pairs, hide reads with no mate). Those
// thin the coverage histogram too, so they belong here, not under "Read
// connections" where they used to hide. Phrased as "Hide..." so they read as
// filters, not visibility toggles that belong under "Show...". The model slots
// (drawProperPairs / drawSingletons) stay show-oriented, so the checked state is
// inverted here: checked = filtered out.
export function getFiltersMenuItem(
  model: FiltersModel,
  options: FiltersMenuOptions = {},
) {
  const { pairFilters } = options
  const openDialog = () => {
    getSession(model).queueDialog(handleClose => [
      FilterByTagDialog,
      { model, handleClose },
    ])
  }
  return pairFilters
    ? {
        label: 'Filter by...',
        icon: FilterAltIcon,
        type: 'subMenu' as const,
        subMenu: [
          checkboxItem(
            'Hide proper pairs',
            !pairFilters.drawProperPairs,
            () => {
              pairFilters.setDrawProperPairs(!pairFilters.drawProperPairs)
            },
            {
              helpText:
                'Hides concordant read pairs: those the aligner flagged as ' +
                'properly paired (SAM flag 0x2) AND in normal forward/reverse ' +
                '(FR) orientation. Discordant pairs (RR/LL/RL orientation, ' +
                'e.g. inversions or duplications) stay visible even if flagged ' +
                'proper, so structural-variant signal is not lost.',
            },
          ),
          checkboxItem(
            'Hide reads without a mate',
            !pairFilters.drawSingletons,
            () => {
              pairFilters.setDrawSingletons(!pairFilters.drawSingletons)
            },
            {
              helpText:
                'Hides reads whose mate or split/supplementary segment is not ' +
                'present in the view, so the read stands alone (samtools calls ' +
                'these "singletons"). Grouped by read name, so it applies to a ' +
                'plain pileup too.',
            },
          ),
          { type: 'divider' as const },
          {
            label: 'Edit read name / tag / flag filters...',
            onClick: () => {
              openDialog()
            },
          },
        ] satisfies MenuItem[],
      }
    : {
        label: 'Edit filters...',
        icon: FilterAltIcon,
        onClick: () => {
          openDialog()
        },
      }
}
