import { resolveSubMenu, toggleItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  collapseGroupRowsItems,
  groupByRadioMenuItem,
  hiddenGroupsItems,
  pickGroupByOptions,
} from '@jbrowse/plugin-alignments'

import type { Pin } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  CollapseGroupRowsModel,
  GroupBy,
  HiddenGroupsModel,
} from '@jbrowse/plugin-alignments'

interface GroupByModel {
  groupBy?: GroupBy
  setGroupBy: (groupBy?: GroupBy) => void
  // A synteny track carries the inherited `linkedReads` slot, so chain layout is
  // reachable here from a config or session even though this menu offers no way
  // in. `groupByRadioMenuItem` needs it to drop the per-read dimensions the
  // worker would degrade to ungrouped.
  isChainMode: boolean
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
    isChainMode: model.isChainMode,
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
  //
  // Offered only while mate-assembly grouping is on, which is the same condition
  // `hiddenGroupKeys` reads: under any other dimension the self alignments are
  // not a lane of their own, so the box hid nothing whichever way it was ticked.
  // Absent rather than disabled, like `collapseGroupRowsItems` and the interbase
  // toggle below.
  return {
    ...item,
    subMenu: [
      ...resolveSubMenu(item),
      ...(model.groupBy?.type === 'mateAssembly'
        ? [
            { type: 'divider' as const },
            toggleItem(
              'Hide self-alignment lane',
              model.hideSelfAlignments,
              model.setHideSelfAlignments,
              {
                helpText:
                  "Drop the mate-assembly lane for the view's own assembly. " +
                  "An aligner skips each sequence's own diagonal, so that " +
                  "lane holds no self-alignment line — only the assembly's " +
                  'internal repeats.',
              },
            ),
          ]
        : []),
    ] satisfies MenuItem[],
  }
}

interface ShowModel extends CollapseGroupRowsModel, HiddenGroupsModel {
  showLegend: boolean
  setShowLegend: (show: boolean) => void
  showLegendDisplayTypeDefault: Pin
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
export function getSyntenyShowMenuItems(model: ShowModel) {
  return makeShowSubMenu([
    legendCheckboxItem(model),
    toggleItem('Show coverage', model.showCoverage, model.setShowCoverage, {
      helpText:
        'Draw a histogram of how deeply each reference base is covered by ' +
        'the aligned blocks — the depth of syntenic coverage.',
    }),
    toggleItem('Show alignments', model.showPileup, model.setShowPileup, {
      helpText:
        'Uncheck to collapse the stacked alignment blocks, leaving just ' +
        'the coverage histogram.',
    }),
    // Only while grouping is in effect — for an all-vs-all track grouped by
    // mate assembly this is the default, one band per mate genome.
    ...collapseGroupRowsItems(model),
    ...hiddenGroupsItems(model),
    toggleItem(
      'Show mismatches',
      model.showMismatches,
      model.setShowMismatches,
      {
        helpText:
          'Draw per-base differences between the two assemblies, read from ' +
          "the alignment's cs tag or CIGAR.",
      },
    ),
    // Only while the coverage band is drawn. Every interbase mark lives in
    // that band — `COVERAGE_LAYERS` is drawn under `showCoverage`, and the
    // hit test gates on `showCoverage && showInterbaseIndicators` — and this
    // display defaults coverage OFF, unlike the alignments display it borrows
    // the menu shape from. So on a synteny track the toggle spent most of its
    // life unable to change anything a user could see. It previously said so
    // in its own helpText, which is the tell: a checkbox that has to explain
    // why it does nothing should not be offered.
    ...(model.showCoverage
      ? [
          toggleItem(
            'Show interbase indicators',
            model.showInterbaseIndicators,
            model.setShowInterbaseIndicators,
            {
              helpText:
                'Mark insertions in the other assembly, which occupy no ' +
                'reference base, with a between-base tick in the coverage band.',
            },
          ),
        ]
      : []),
  ] satisfies MenuItem[])
}
