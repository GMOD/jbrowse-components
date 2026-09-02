import { Fragment, useState } from 'react'

import { ContextMenu } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
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
import { laneExpandable } from '../lanes.ts'
import { bandScreenTop, sectionKey } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { ContextMenuAnchor } from '@jbrowse/core/ui'
import type React from 'react'

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
    // Plain header when the pileup is hidden: collapse/expand are no-ops on a
    // coverage-only stack, so the group name carries no button. It still takes
    // the right-click that hides the lane, which is why the caller hands it
    // `pointerEvents` rather than this class fixing them off — the row above is
    // `none` so the gaps around the chips don't swallow the coverage hover, and
    // a chip that answers a click has to opt back in exactly as the button does.
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
  // The chip's right-click target, held as one value: the click point and which
  // lane it landed on can't disagree, and `undefined` is the closed state. Local
  // rather than on the model — nothing outside this overlay asks where a menu
  // is, and the pileup's own context menu is a separate surface.
  const [laneMenu, setLaneMenu] = useState<{
    anchor: ContextMenuAnchor
    groupKey: string
    label: string
  }>()
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
  // Hiding the last drawn lane leaves a stack with no chip in it, so the only
  // way back would be the "Show..." menu row — offered, but a worse place to
  // land than simply not offering the action that empties the track.
  const canHideLane = renderSections.length > 1
  const openLaneMenu = (
    event: React.MouseEvent,
    groupKey: string,
    label: string,
  ) => {
    if (canHideLane) {
      event.preventDefault()
      setLaneMenu({
        anchor: { clientX: event.clientX, clientY: event.clientY },
        groupKey,
        label,
      })
    }
  }
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
                  onContextMenu={event => {
                    openLaneMenu(event, section.groupKey, label)
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
                <span
                  className={classes.label}
                  style={{ pointerEvents: canHideLane ? 'auto' : 'none' }}
                  data-testid="group-label-text"
                  onContextMenu={event => {
                    openLaneMenu(event, section.groupKey, label)
                  }}
                >
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
      <ContextMenu
        anchor={laneMenu?.anchor}
        menuItems={
          laneMenu
            ? [
                {
                  label: `Hide "${laneMenu.label}"`,
                  icon: VisibilityOffIcon,
                  onClick: () => {
                    model.hideGroup(laneMenu.groupKey)
                  },
                },
              ]
            : []
        }
        onClose={() => {
          setLaneMenu(undefined)
        }}
      />
    </>
  )
})

export default GroupLabelsOverlay
