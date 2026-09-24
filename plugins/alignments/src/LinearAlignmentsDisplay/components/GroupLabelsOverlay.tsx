import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import { observer } from 'mobx-react'

import { laneExpandable } from '../lanes.ts'
import { bandScreenTop } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

// The second chip: what the group's height button does, says and looks like.
// One place decides all three, because they have to describe the same action —
// four parallel ternaries over the same two flags drifted apart every time one
// of them gained a case.
//
// Collapsed-rows lanes hide nothing (overlapping alignments are drawn as tint
// depth on the one row), so the action there is "expand this lane into a true
// stack", not "show what was clipped". They also go icon-only: a
// one-row-per-group track exists to fit many groups on screen, and a word of
// button text beside every one of them covers the left of every lane.
function groupHeightAffordance({
  collapseGroupRows,
  hasOverride,
  featureNoun,
}: {
  collapseGroupRows: boolean
  hasOverride: boolean
  featureNoun: string
}) {
  if (hasOverride) {
    return {
      Icon: UnfoldLessIcon,
      title: collapseGroupRows
        ? 'Collapse this group back to one row'
        : 'Fit group to view',
      text: collapseGroupRows ? undefined : 'Fit to view',
    }
  }
  return {
    Icon: UnfoldMoreIcon,
    title: collapseGroupRows
      ? 'Expand this group into a stacked layout'
      : `Show all ${featureNoun}s in this group`,
    text: collapseGroupRows ? undefined : `Show all ${featureNoun}s`,
  }
}

// This display's lanes as chip sections: each chip sits at its section's
// coverage-band top, so it scrolls with the stack like the coverage it heads
// (a lone section's coverage is sticky instead, which `bandScreenTop` handles
// off `scrollModel.isGrouped`).
const GroupLabelsOverlay = observer(function GroupLabelsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  if (!model.showsGroupLabels) {
    return null
  }
  // With the pileup hidden every group's pileup height is 0, so collapse and
  // "show all"/"fit to view" have nothing to act on — render plain labels.
  const {
    scrollModel: scroll,
    showPileup,
    collapseGroupRows,
    canSizeGroupHeights,
    renderSections,
  } = model
  // Hiding the last drawn lane leaves no chip to carry the restore button.
  const canHideLane = renderSections.length > 1
  return (
    <GroupLabelChips
      canvasHeight={scroll.canvasHeight}
      hiddenCount={model.hiddenGroups.size}
      onShowHidden={() => {
        model.showAllGroups()
      }}
      sections={renderSections.map(section => {
        // Off the section, not looked back up by its key: a `renderSections`
        // entry IS its lane, chip state included.
        const { groupKey, label, collapsed } = section
        const hasOverride = section.heightOverridePx !== undefined
        return {
          key: groupKey,
          label: model.groupChipLabel(label),
          top: bandScreenTop(section.coverageTop, scroll),
          height: section.height,
          toggle: showPileup
            ? {
                collapsed,
                title: collapsed
                  ? 'Show this group’s pileup'
                  : 'Collapse this group to coverage only',
                onClick: () => {
                  model.toggleGroupCollapsed(groupKey)
                },
              }
            : undefined,
          // Restore a manually-sized group to the fit budget; otherwise a
          // "show all" affordance only when reads were actually clipped by a
          // cap this button can raise, so its presence signals reachable
          // hidden reads.
          action:
            canSizeGroupHeights &&
            !collapsed &&
            (hasOverride || laneExpandable(section))
              ? {
                  ...groupHeightAffordance({
                    collapseGroupRows,
                    hasOverride,
                    featureNoun: model.featureNoun,
                  }),
                  onClick: () => {
                    model.toggleGroupExpanded(groupKey)
                  },
                }
              : undefined,
          onHide: canHideLane
            ? () => {
                model.hideGroup(groupKey)
              }
            : undefined,
        }
      })}
    />
  )
})

export default GroupLabelsOverlay
