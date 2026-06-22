import { makeStyles } from '@jbrowse/core/util/tss-react'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import { observer } from 'mobx-react'

import { bandOnScreen, bandScreenTop } from './sectionScreen.ts'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    background: theme.palette.divider,
    pointerEvents: 'none',
    zIndex: 6,
  },
  controls: {
    position: 'absolute',
    left: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    zIndex: 6,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 4px',
    fontSize: 11,
    lineHeight: '14px',
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    opacity: 0.85,
    borderRadius: 3,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    border: 'none',
    userSelect: 'none',
    '&:hover': {
      opacity: 1,
    },
  },
  icon: {
    fontSize: 14,
  },
}))

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
  const { scrollModel: scroll } = model
  return (
    <>
      {model.renderSections.map((section, i) => {
        const top = bandScreenTop(section.coverageTop, scroll)
        if (!bandOnScreen(top, section.coverageHeight, scroll)) {
          return null
        }
        const collapsed = model.isGroupCollapsed(section.groupKey)
        const expanded = model.isGroupExpanded(section.groupKey)
        return (
          <div key={section.groupKey === '' ? 'ungrouped' : section.groupKey}>
            {i > 0 ? <div className={classes.divider} style={{ top }} /> : null}
            <div
              className={classes.controls}
              style={{ top: Math.max(0, top) + 1 }}
            >
              <button
                type="button"
                className={classes.button}
                onClick={() => {
                  model.toggleGroupCollapsed(section.groupKey)
                }}
                title={collapsed ? 'Expand group' : 'Collapse group'}
              >
                {`${collapsed ? '▸' : '▾'} ${section.label || 'ungrouped'}`}
              </button>
              {collapsed ? null : (
                <button
                  type="button"
                  className={classes.button}
                  onClick={() => {
                    model.toggleGroupExpanded(section.groupKey)
                  }}
                  title={
                    expanded
                      ? 'Fit group to view'
                      : 'Expand group (show all reads)'
                  }
                >
                  {expanded ? (
                    <UnfoldLessIcon className={classes.icon} />
                  ) : (
                    <UnfoldMoreIcon className={classes.icon} />
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
