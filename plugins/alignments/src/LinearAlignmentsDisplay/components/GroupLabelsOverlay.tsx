import { makeStyles } from '@jbrowse/core/util/tss-react'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import { observer } from 'mobx-react'

import { bandOnScreen, bandScreenTop, sectionKey } from './sectionScreen.ts'
import {
  GROUP_LABEL_BG_OPACITY,
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_PADDING_X,
  GROUP_LABEL_RADIUS,
  groupSectionLabel,
} from '../groupLabelStyle.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

const useStyles = makeStyles()(theme => {
  const chip = {
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${GROUP_LABEL_PADDING_X}px`,
    fontSize: GROUP_LABEL_FONT_SIZE,
    lineHeight: '14px',
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    opacity: GROUP_LABEL_BG_OPACITY,
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
      left: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      zIndex: 6,
    },
    button: {
      ...chip,
      cursor: 'pointer',
      border: 'none',
      '&:hover': {
        opacity: 1,
      },
    },
    // Non-interactive header when the pileup is hidden — collapse/expand are
    // no-ops on a coverage-only stack, so the group name is just a label.
    label: chip,
    icon: {
      fontSize: 14,
    },
  }
})

// Inline section dividers + labels between stacked groups (in-track group-by).
// Only rendered when grouping is active; ungrouped displays show nothing. The
// labels sit at each section's scrolled coverage-band top, so they scroll with
// the stack like the coverage they head.
const GroupLabelsOverlay = observer(function GroupLabelsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
  if (!model.isGrouped) {
    return null
  }
  // Grouping is active here, so the coverage band scrolls with its section.
  // With the pileup hidden every group's pileup height is 0, so collapse and
  // "show all"/"fit to view" have nothing to act on — render plain labels.
  const { scrollModel: scroll, showPileup } = model
  return (
    <>
      {model.renderSections.map((section, i) => {
        const top = bandScreenTop(section.coverageTop, scroll)
        if (!bandOnScreen(top, section.coverageHeight, scroll)) {
          return null
        }
        const label = groupSectionLabel(section.label)
        const collapsed = model.isGroupCollapsed(section.groupKey)
        const hasOverride = model.hasGroupHeightOverride(section.groupKey)
        const truncated = model.isGroupTruncated(section.groupKey)
        return (
          <div key={sectionKey(section.groupKey)}>
            {i > 0 ? <div className={classes.divider} style={{ top }} /> : null}
            <div
              className={classes.controls}
              style={{ top: Math.max(0, top) + 1 }}
            >
              {showPileup ? (
                <button
                  type="button"
                  className={classes.button}
                  onClick={() => {
                    model.toggleGroupCollapsed(section.groupKey)
                  }}
                  title={collapsed ? 'Expand group' : 'Collapse group'}
                >
                  {collapsed ? (
                    <ChevronRightIcon className={classes.icon} />
                  ) : (
                    <ExpandMoreIcon className={classes.icon} />
                  )}
                  {label}
                </button>
              ) : (
                <span className={classes.label}>{label}</span>
              )}
              {/* Restore a manually-sized group to the fit budget; otherwise a
                  "show all" affordance only when reads were actually clipped, so
                  the button's presence signals hidden reads. Gated on showPileup
                  since both actions resize the (hidden) pileup. */}
              {!showPileup ||
              collapsed ||
              (!hasOverride && !truncated) ? null : (
                <button
                  type="button"
                  className={classes.button}
                  onClick={() => {
                    model.toggleGroupExpanded(section.groupKey)
                  }}
                  title={
                    hasOverride
                      ? 'Fit group to view'
                      : 'Show all reads in this group'
                  }
                >
                  {hasOverride ? (
                    <>
                      <UnfoldLessIcon className={classes.icon} />
                      Fit to view
                    </>
                  ) : (
                    <>
                      <UnfoldMoreIcon className={classes.icon} />
                      Show all reads
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
})

export default GroupLabelsOverlay
