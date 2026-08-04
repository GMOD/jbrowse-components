import { checkboxItem } from '@jbrowse/core/ui'
import {
  collapseGroupRowsItems,
  groupByRadioMenuItem,
  pickGroupByOptions,
} from '@jbrowse/plugin-alignments'
import VisibilityIcon from '@mui/icons-material/Visibility'

import type { MenuItem } from '@jbrowse/core/ui'
import type {
  CollapseGroupRowsModel,
  GroupByType,
} from '@jbrowse/plugin-alignments'

interface GroupByModel {
  groupBy?: { type: GroupByType }
  setGroupBy: (groupBy?: { type: GroupByType }) => void
  hideSelfAlignments: boolean
  setHideSelfAlignments: (flag: boolean) => void
}

// Synteny grouping is a plain radio group, not the alignments Group-by dialog:
// the dialog's dimensions are read/pair concepts (tag, pair orientation,
// duplicate, ...) that a PAF block has no answer for, and the one dimension that
// matters here — mate assembly, which stacks each mate sample of an all-vs-all
// track into its own section — is `hidden` there precisely so this menu can own
// it. Labels come from the shared registry so they can't drift from the dialog.
const GROUP_OPTIONS = pickGroupByOptions('mateAssembly', 'strand', 'mapq')

export function getSyntenyGroupByMenuItem(model: GroupByModel) {
  const item = groupByRadioMenuItem({
    current: model.groupBy?.type,
    options: GROUP_OPTIONS,
    onSelect: type => {
      model.setGroupBy({ type })
    },
    onNone: () => {
      model.setGroupBy(undefined)
    },
  })
  // Appended after the shared builder's dimension radios, behind a divider so a
  // checkbox doesn't read as one of them. Synteny-specific: only an all-vs-all
  // track has a self lane.
  return {
    ...item,
    subMenu: [
      ...item.subMenu,
      { type: 'divider' as const },
      checkboxItem(
        'Hide self-alignment lane',
        model.hideSelfAlignments,
        () => {
          model.setHideSelfAlignments(!model.hideSelfAlignments)
        },
        {
          helpText:
            "Drop the mate-assembly lane for the view's own assembly. An " +
            "aligner skips each sequence's own diagonal, so that lane holds " +
            "no self-alignment line — only the assembly's internal repeats.",
        },
      ),
    ] satisfies MenuItem[],
  }
}

interface ShowModel extends CollapseGroupRowsModel {
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
}

// Visibility of the rendering layers, mirroring the alignments "Show..." menu
// (reads.ts) but only the layers a synteny block can populate: SyntenyFeature
// implements forEachMismatch off the cs tag / CIGAR, so mismatches and insertion
// indicators are real, while the read-category toggles there (proper pairs,
// singletons, split alignments, soft clipping, base-quality fade) have no
// meaning for PAF and are omitted rather than shown as dead checkboxes.
//
// Toggles only, like its twin — the row cap lives in the shared feature-height
// menu, which this display also builds.
export function getSyntenyShowMenuItem(model: ShowModel) {
  return {
    label: 'Show...',
    icon: VisibilityIcon,
    type: 'subMenu' as const,
    subMenu: [
      checkboxItem('Show legend', model.showLegend, () => {
        model.setShowLegend(!model.showLegend)
      }),
      checkboxItem(
        'Show coverage',
        model.showCoverage,
        () => {
          model.setShowCoverage(!model.showCoverage)
        },
        {
          helpText:
            'Draw a histogram of how deeply each reference base is covered by ' +
            'the aligned blocks — the depth of syntenic coverage.',
        },
      ),
      checkboxItem(
        'Show alignments',
        model.showPileup,
        () => {
          model.setShowPileup(!model.showPileup)
        },
        {
          helpText:
            'Uncheck to collapse the stacked alignment blocks, leaving just ' +
            'the coverage histogram.',
        },
      ),
      // Only while grouping is in effect — for an all-vs-all track grouped by
      // mate assembly this is the default, one band per mate genome.
      ...collapseGroupRowsItems(model),
      checkboxItem(
        'Show mismatches',
        model.showMismatches,
        () => {
          model.setShowMismatches(!model.showMismatches)
        },
        {
          helpText:
            'Draw per-base differences between the two assemblies, read from ' +
            "the alignment's cs tag or CIGAR.",
        },
      ),
      checkboxItem(
        'Show interbase indicators',
        model.showInterbaseIndicators,
        () => {
          model.setShowInterbaseIndicators(!model.showInterbaseIndicators)
        },
        {
          helpText:
            'Mark insertions in the other assembly, which occupy no reference ' +
            'base, with a between-base tick. Drawn in the coverage band, so it ' +
            'needs "Show coverage" on.',
        },
      ),
    ] satisfies MenuItem[],
  }
}
