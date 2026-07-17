import {
  getMaxHeightMenuItem,
  groupByRadioMenuItem,
  pickGroupByOptions,
} from '@jbrowse/plugin-alignments'
import VisibilityIcon from '@mui/icons-material/Visibility'

import type { MenuItem } from '@jbrowse/core/ui'
import type { GroupByType } from '@jbrowse/plugin-alignments'

interface GroupByModel {
  groupBy?: { type: GroupByType }
  setGroupBy: (groupBy?: { type: GroupByType }) => void
}

// Synteny grouping is a plain radio group, not the alignments Group-by dialog:
// the dialog's dimensions are read/pair concepts (tag, pair orientation,
// duplicate, ...) that a PAF block has no answer for, and the one dimension that
// matters here — mate assembly, which stacks each mate sample of an all-vs-all
// track into its own section — is `hidden` there precisely so this menu can own
// it. Labels come from the shared registry so they can't drift from the dialog.
const GROUP_OPTIONS = pickGroupByOptions('mateAssembly', 'strand', 'mapq')

export function getSyntenyGroupByMenuItem(model: GroupByModel) {
  return groupByRadioMenuItem({
    current: model.groupBy?.type,
    options: GROUP_OPTIONS,
    onSelect: type => {
      model.setGroupBy({ type })
    },
    onNone: () => {
      model.setGroupBy(undefined)
    },
  })
}

interface ShowModel {
  showLegend: boolean
  setShowLegend: (show: boolean | undefined) => void
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
  showPileup: boolean
  setShowPileup: (show: boolean) => void
  showMismatches: boolean
  setShowMismatches: (show: boolean) => void
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void
  maxHeight: number
  setMaxHeight: (height?: number) => void
}

// Visibility of the rendering layers, mirroring the alignments "Show..." menu
// (reads.ts) but only the layers a synteny block can populate: SyntenyFeature
// implements forEachMismatch off the cs tag / CIGAR, so mismatches and insertion
// indicators are real, while the read-category toggles there (proper pairs,
// singletons, split alignments, soft clipping, base-quality fade) have no
// meaning for PAF and are omitted rather than shown as dead checkboxes.
export function getSyntenyShowMenuItem(model: ShowModel) {
  return {
    label: 'Show...',
    icon: VisibilityIcon,
    type: 'subMenu' as const,
    subMenu: [
      {
        label: 'Show legend',
        type: 'checkbox' as const,
        checked: model.showLegend,
        onClick: () => {
          model.setShowLegend(!model.showLegend)
        },
      },
      {
        label: 'Show coverage',
        type: 'checkbox' as const,
        checked: model.showCoverage,
        helpText:
          'Draw a histogram of how deeply each reference base is covered by ' +
          'the aligned blocks — the depth of syntenic coverage.',
        onClick: () => {
          model.setShowCoverage(!model.showCoverage)
        },
      },
      {
        label: 'Show alignments',
        type: 'checkbox' as const,
        checked: model.showPileup,
        helpText:
          'Uncheck to collapse the stacked alignment blocks, leaving just ' +
          'the coverage histogram.',
        onClick: () => {
          model.setShowPileup(!model.showPileup)
        },
      },
      {
        label: 'Show mismatches',
        type: 'checkbox' as const,
        checked: model.showMismatches,
        helpText:
          'Draw per-base differences between the two assemblies, read from ' +
          "the alignment's cs tag or CIGAR.",
        onClick: () => {
          model.setShowMismatches(!model.showMismatches)
        },
      },
      {
        label: 'Show interbase indicators',
        type: 'checkbox' as const,
        checked: model.showInterbaseIndicators,
        helpText:
          'Mark insertions in the other assembly, which occupy no reference ' +
          'base, with a between-base tick. Drawn in the coverage band, so it ' +
          'needs "Show coverage" on.',
        onClick: () => {
          model.setShowInterbaseIndicators(!model.showInterbaseIndicators)
        },
      },
      { type: 'divider' as const },
      getMaxHeightMenuItem(model),
    ] satisfies MenuItem[],
  }
}
