import { Fragment } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import {
  GROUP_LABEL_BG_OPACITY,
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_HEIGHT,
  GROUP_LABEL_ICON_SIZE,
  GROUP_LABEL_INSET_X,
  GROUP_LABEL_PADDING_X,
  GROUP_LABEL_RADIUS,
  groupChipTop,
  groupSectionLabel,
} from '../groupLabelStyle.ts'
import { laneExpandable } from '../model.ts'
import { bandScreenTop, sectionKey } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

const useStyles = makeStyles()(theme => {
  const chip = {
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${GROUP_LABEL_PADDING_X}px`,
    fontSize: GROUP_LABEL_FONT_SIZE,
    // The same constant the section layout reserves per labelled section, so a
    // chip can never outgrow the space left for it.
    height: GROUP_LABEL_HEIGHT,
    color: theme.palette.text.secondary,
    background: alpha(theme.palette.background.paper, GROUP_LABEL_BG_OPACITY),
    borderRadius: GROUP_LABEL_RADIUS,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  }
  return {
    divider: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      height: 1,
      background: theme.palette.divider,
      pointerEvents: 'none' as const,
      zIndex: 6,
    },
    controls: {
      position: 'absolute' as const,
      left: GROUP_LABEL_INSET_X,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      zIndex: 6,
      // The row is only as wide as its chips, but it still sits over the left
      // edge of every coverage band; without this the gap around the chips (and
      // the whole non-interactive label, when the pileup is hidden) swallowed
      // the coverage hover there. The chips take pointer events back below.
      pointerEvents: 'none' as const,
    },
    button: {
      ...chip,
      cursor: 'pointer',
      border: 'none',
      pointerEvents: 'auto' as const,
      '&:hover': {
        background: theme.palette.background.paper,
      },
    },
    // Non-interactive header when the pileup is hidden — collapse/expand are
    // no-ops on a coverage-only stack, so the group name is just a label.
    label: chip,
    icon: {
      fontSize: GROUP_LABEL_ICON_SIZE,
    },
  }
})

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

// Inline section dividers + labels between stacked groups (in-track group-by).
// Only rendered when grouping is active; ungrouped displays show nothing. The
// labels sit at each section's coverage-band top, so they scroll with the stack
// like the coverage they head (a lone section's coverage is sticky instead, which
// `bandScreenTop` handles off `scrollModel.isGrouped`).
const GroupLabelsOverlay = observer(function GroupLabelsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
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
  return (
    <>
      {renderSections.map((section, i) => {
        const top = bandScreenTop(section.coverageTop, scroll)
        // Cull and sticky-pin per `groupChipTop`, which the export shares.
        const chipTop = groupChipTop(top, section.height, scroll)
        if (chipTop === undefined) {
          return null
        }
        const label = groupSectionLabel(section.label)
        // Off the section, not looked back up by its key: a `renderSections`
        // entry IS its lane, chip state included.
        const { collapsed } = section
        const hasOverride = section.heightOverridePx !== undefined
        const heightButton =
          canSizeGroupHeights &&
          !collapsed &&
          (hasOverride || laneExpandable(section))
            ? groupHeightAffordance({
                collapseGroupRows,
                hasOverride,
                featureNoun: model.featureNoun,
              })
            : undefined
        return (
          <Fragment key={sectionKey(section.groupKey)}>
            {i > 0 ? <div className={classes.divider} style={{ top }} /> : null}
            <div
              className={classes.controls}
              style={{ top: chipTop + 1 }}
              data-testid="group-label-chip"
            >
              {showPileup ? (
                <button
                  type="button"
                  className={classes.button}
                  onClick={() => {
                    model.toggleGroupCollapsed(section.groupKey)
                  }}
                  title={
                    collapsed
                      ? 'Show this group’s pileup'
                      : 'Collapse this group to coverage only'
                  }
                >
                  {collapsed ? (
                    <ChevronRightIcon className={classes.icon} />
                  ) : (
                    <ExpandMoreIcon className={classes.icon} />
                  )}
                  <span data-testid="group-label-text">{label}</span>
                </button>
              ) : (
                <span className={classes.label} data-testid="group-label-text">
                  {label}
                </span>
              )}
              {/* Restore a manually-sized group to the fit budget; otherwise a
                  "show all" affordance only when reads were actually clipped by
                  a cap this button can raise, so its presence signals reachable
                  hidden reads. */}
              {heightButton ? (
                <button
                  type="button"
                  className={classes.button}
                  onClick={() => {
                    model.toggleGroupExpanded(section.groupKey)
                  }}
                  title={heightButton.title}
                >
                  <heightButton.Icon className={classes.icon} />
                  {heightButton.text}
                </button>
              ) : null}
            </div>
          </Fragment>
        )
      })}
    </>
  )
})

export default GroupLabelsOverlay
